from fedex.services.location_service import FedexSearchLocationRequest
from fedex.services.ship_service import FedexProcessShipmentRequest
from fedex.tools.conversion import sobject_to_json, sobject_to_dict
from fedex.config import FedexConfig
from flask import Flask, request, jsonify, redirect, url_for
import json
import datetime
import time
from itsdangerous import Signer
import base64
from flask_cors import CORS
import re

import asyncio
import websockets

signer = Signer("fkdsds94345")

app = Flask(__name__)
CORS(app)

CONFIG_OBJ = FedexConfig(key='Zh3lWnStjT857BhE',
                         password='MONHTNd7sHWnrjRecJ9MtdqqT',
                         account_number='448139921',
                         meter_number='253113345')


# @app.route("/api/validate/zip/<zipcode>", methods=['GET'])
# def zips(zipcode):
#     # https: // stackoverflow.com / a / 48148513
#     result = zipcodes.matching(zipcode)
#     if result:
#         long = float(result[0]['long'])
#         lat = float(result[0]['lat'])
#         return jsonify([long, lat])
#     return "", 404

@app.route("/api/locations/<zipcode>", methods=['GET'])
def locations(zipcode):
    #
    # if not valid zip code
    #     return 400

    location_request = FedexSearchLocationRequest(CONFIG_OBJ)
    location_request.Address.PostalCode = zipcode
    location_request.Address.CountryCode = 'US'
    hal = location_request.create_wsdl_object_of_type("LocationCapabilityDetail")
    hal.TransferOfPossessionType = 'HOLD_AT_LOCATION'
    hal.CarrierCode = 'FDXE'
    location_request.Constraints.RequiredLocationCapabilities.append(hal)
    # location_request.Constraints.LocationTypesToInclude.append("FEDEX_OFFICE")
    # location_request.Constraints.LocationTypesToInclude.append("FEDEX_EXPRESS_STATION")
    location_request.send_request()
    location_json = sobject_to_json(location_request.response.AddressToLocationRelationships[0])
    location_dict = sobject_to_dict(location_request.response.AddressToLocationRelationships[0])
    session = {}
    res_dict = {}
    regex = re.compile(r'(?:-|\+)\d+\.?\d*')

    res_dict["coords"] = [float(x) for x in reversed(regex.findall(location_dict['MatchedAddressGeographicCoordinates']))]
    res_dict["locations"] = {}
    for loc in location_dict['DistanceAndLocationDetails']:
        loc = loc['LocationDetail']
        id = loc['LocationId']
        inside = loc['LocationContactAndAddress']['AddressAncillaryDetail'].get('LocationInProperty', None)
        if loc['LocationType'] == 'FEDEX_ONSITE':
            name = loc['LocationContactAndAddress']['AddressAncillaryDetail']['AdditionalDescriptions']
        elif inside:
            name = [loc['LocationContactAndAddress']['Contact']['CompanyName'], inside]
        else:
            name = [loc['LocationContactAndAddress']['Contact']['CompanyName']]
        string = json.dumps(loc['LocationContactAndAddress']['Address'])
        b64string = base64.b64encode(bytes(string, "utf-8"))
        value = signer.sign(b64string).decode('UTF-8')
        street = loc['LocationContactAndAddress']['Address']['StreetLines']
        city = loc['LocationContactAndAddress']['Address']['City']
        state = loc['LocationContactAndAddress']['Address']['StateOrProvinceCode']
        postal = loc['LocationContactAndAddress']['Address']['PostalCode']
        coords = [float(x) for x in reversed(regex.findall(loc['LocationContactAndAddress']['Address']['GeographicCoordinates']))]
        hours = []
        phone = loc['LocationContactAndAddress']['Contact'].get("PhoneNumber", None)
        for day in loc['NormalHours']:
            try:
                hours.append([day['DayofWeek'], day['Hours'][0]['Begins'], day['Hours'][0]['Ends']])
            except(KeyError) as e:
                hours.append([day['DayofWeek'], None, None])
        res_dict["locations"][id] = {
            "name": name,
            "value": value,
            "street": street,
            "city": city,
            "postal": postal,
            "state": state,
            "coords": coords,
            "phone": phone,
            "hours": hours,
            "inside": inside
        }

    # for location in location_dict['DistanceAndLocationDetails']:
    #     location = location.pop('LocationDetail')
    #     locationId = str(location.pop('LocationId'))
    #     location.pop('StoreNumber', None)
    #     location.pop('LocationType', None)
    #     location.pop('Attributes', None)
    #     location.pop('LocationCapabilities', None)
    #     location.pop('CarrierDetails', None)
    #     location.pop('PackageMaximumLimits', None)
    #     session[locationId] = location

    response = app.response_class(
        response=json.dumps(res_dict, default=lambda x: x.__str__() if isinstance(x, datetime.time) else None),
        status=200,
        mimetype='application/json'
    )

    return response

app.route("/api/ship", methods=['POST'])
def ship(location):

    first = request.form.get("first")
    last = request.form.get("last")
    phone = request.form.get("phone")
    email = request.form.get("email")
    location = request.get_json()

    # validate phone number
    if not phonenumbers.is_valid_number(phonenumbers.parse(phone, "US")):
        return 400

    # validate name
    # https://stackoverflow.com/questions/15558392/how-can-i-check-if-character-in-a-string-is-a-letter-python

    shipment = FedexProcessShipmentRequest(CONFIG_OBJ)
    shipment.RequestedShipment.DropoffType = 'REGULAR_PICKUP'
    shipment.RequestedShipment.ServiceType = 'FEDEX_EXPRESS_SAVER'
    shipment.RequestedShipment.PackagingType = 'YOUR_PACKAGING'

    # recipient notification
    noti = shipment.create_wsdl_object_of_type("ShipmentEventNotificationSpecification")
    noti.Events = ['ON_DELIVER', 'ON_EXCEPTION', 'ON_TENDER']
    noti.NotificationDetail.EmailDetail.EmailAddress = email
    noti.NotificationDetail.EmailDetail.Name = first + ' ' + last
    noti.NotificationDetail.NotificationType = 'EMAIL'
    noti.FormatSpecification.Type = 'HTML'
    noti.Role = 'RECIPIENT'

    # shipper notification
    # noti2 = shipment.create_wsdl_object_of_type("ShipmentEventNotificationSpecification")
    # noti2.Events = ['ON_DELIVER', 'ON_EXCEPTION', 'ON_TENDER']
    # noti2.EmailDetail.EmailAddress = 'TALKTOBRENT@GMAIL.COM'
    # noti2.FormatSpecification.Type = 'TEXT'
    # noti2.Role = 'SHIPPER'

    shipment.RequestedShipment.SpecialServicesRequested.EventNotificationDetail.EventNotifications.append(noti)
    #shipment.RequestedShipment.SpecialServicesRequested.EventNotificationDetail.EventNotifications.append(noti2)

    # return label
    shipment.RequestedShipment.SpecialServicesRequested.ReturnShipmentDetail.ReturnType = 'PRINT_RETURN_LABEL'

    # hide shipper info from recipient
    shipment.RequestedShipment.LabelSpecification.CustomerSpecifiedDetail.MaskedData = ['SHIPPER_ACCOUNT_NUMBER', 'SHIPPER_INFORMATION', 'INSURED_VALUE']

    # set addresses for HAL and recipient
    shipment.RequestedShipment.SpecialServicesRequested.HoldAtLocationDetail.LocationId = location
    shipment.RequestedShipment.SpecialServicesRequested.HoldAtLocationDetail.PhoneNumber = phone
    for key, value in location['LocationContactAndAddress']["Address"].items():
        setattr(shipment.RequestedShipment.ShipmentSpecialServicesRequested.HoldAtLocationDetail.LocationContactAndAddress.Address, key, value)
        setattr(shipment.RequestedShipment.Recepient.Address, key, value)

    # shipper contact
    shipment.RequestedShipment.Shipper.Contact.PersonName = 'BRENT JANSKI'
    shipment.RequestedShipment.Shipper.Contact.PhoneNumber = '7636079305'

    # shipper address
    shipment.RequestedShipment.Shipper.Address.StreetLines = ['2825 CARGO RD']
    shipment.RequestedShipment.Shipper.Address.City = 'MINNEAPOLIS'
    shipment.RequestedShipment.Shipper.Address.StateOrProvinceCode = 'MN'
    shipment.RequestedShipment.Shipper.Address.PostalCode = '55450'
    shipment.RequestedShipment.Shipper.Address.CountryCode = 'US'

    shipment.RequestedShipment.Recepient.Contact.PersonName = first + ' ' + last
    shipment.RequestedShipment.Recepient.Contact.PhoneNumber = phone

    shipment.RequestedShipment.ShippingChargesPayment.Payor.ResponsibleParty.AccountNumber = CONFIG_OBJ.account_number

    shipment.RequestedShipment.ShippingChargesPayment.PaymentType = 'SENDER'

    shipment.RequestedShipment.LabelSpecification.LabelFormatType = 'COMMON2D'
    shipment.RequestedShipment.LabelSpecification.ImageType = 'PNG'
    shipment.RequestedShipment.LabelSpecification.LabelStockType = 'PAPER_7X4.75'
    shipment.RequestedShipment.LabelSpecification.LabelPrintingOrientation = 'BOTTOM_EDGE_OF_TEXT_FIRST'

    weight = shipment.create_wsdl_object_of_type('Weight')
    weight.Value = 5.0
    weight.Units = "LB"

    dimensions = shipment.create_wsdl_object_of_type('Dimensions')
    dimensions.Units = 'IN'
    dimensions.Length = '12'
    dimensions.Width = '10'
    dimensions.Height = '6'

    package = shipment.create_wsdl_object_of_type('RequestedPackageLineItem')
    package.Weight = weight
    package.Dimensions = dimensions
    shipment.add_package(package)

    shipment.send_validation_request()
    shipment.send_request()

    print("ggg")

if __name__ == '__main__':
    app.run(port=1111)

#https://rethinkdb.com/
#https://openlayers.org/
#mapbox
#https://mediarealm.com.au/articles/openstreetmap-openlayers-map-markers/

# https://stackoverflow.com/questions/52520542/python-valid-phone-numbers

