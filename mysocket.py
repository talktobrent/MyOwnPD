from fedex.services.location_service import FedexSearchLocationRequest
from fedex.services.availability_commitment_service import FedexAvailabilityCommitmentRequest
from fedex.services.ship_service import FedexProcessShipmentRequest
from fedex.tools.conversion import sobject_to_json, sobject_to_dict
from fedex.config import FedexConfig
import phonenumbers
import json
import datetime
import time
from itsdangerous import Signer
import base64
import re
from db import Db

import asyncio
import websockets

signer = Signer("fkdsds94345")

CONFIG_OBJ = FedexConfig(key='Zh3lWnStjT857BhE',
                         password='MONHTNd7sHWnrjRecJ9MtdqqT',
                         account_number='448139921',
                         meter_number='253113345')


async def zip(websocket, path):
    while True:
        data = json.loads(await websocket.recv())
        input = data.get('phone', None)
        if input:
            response = {}
            if len(input) > 1:
                phone = phonenumbers.parse(input, 'US')
                phone = phonenumbers.format_number(phone, phonenumbers.PhoneNumberFormat.NATIONAL)
                response['phone_input'] = phone
                try:
                    if len(input) >= 10 and phonenumbers.is_valid_number(phone):
                        response['phone_valid'] = True
                    else:
                        response['phone_valid'] = False
                except BaseException as e:
                    response['phone_valid'] = False
            else:
                response['phone_input'] = input
                response['phone_valid'] = False
            await websocket.send(json.dumps(response))
            continue
        # style = data.get('style', None)
        # if style:
        #     pass
        zipcode = data.get('zip', None)
        if zipcode:
            ret = Db.get_zip(zipcode)
            await websocket.send(json.dumps(ret))
            if "location" not in ret:
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
                postals = set()
                res_dict["coords"] = [float(x) for x in reversed(regex.findall(location_dict['MatchedAddressGeographicCoordinates']))]
                res_dict["locations"] = {}
                res_dict["zip"] = zipcode
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
                            hours.append([day['DayofWeek'], str(day['Hours'][0]['Begins']), str(day['Hours'][0]['Ends'])])
                        except(KeyError) as e:
                            hours.append([day['DayofWeek'], None, None])
                    res_dict["locations"][id] = {
                        "id": id,
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
                    postals.add(postal)
                await websocket.send(json.dumps(res_dict))
                Db.insert(zipcode, res_dict["coords"])

        commit = data.get('commit', None)
        if commit:
            avc_request = FedexAvailabilityCommitmentRequest(CONFIG_OBJ)
            avc_request.Origin.PostalCode = '55450'
            avc_request.Origin.CountryCode = 'US'
            avc_request.Destination.PostalCode = commit
            avc_request.Destination.CountryCode = 'US'
            avc_request.Service = 'FEDEX_2_DAY'
            avc_request.Packaging = 'YOUR_PACKAGING'

            avc_request.send_request()
            response_dict = sobject_to_dict(avc_request.response)
            date_str = str(response_dict['Options'][0]['DeliveryDate'])
            await websocket.send(json.dumps({'commit': date_str, "id": data['id'], "zip": commit}))




        # asyncio.get_event_loop().run_until_complete(start_server)
        # asyncio.get_event_loop().run_forever()

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


start_server = websockets.serve(zip, "localhost", 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()



#https://rethinkdb.com/
#https://openlayers.org/
#mapbox
#https://mediarealm.com.au/articles/openstreetmap-openlayers-map-markers/

# https://stackoverflow.com/questions/52520542/python-valid-phone-numbers

