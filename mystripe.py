"""
Python 3.6 or newer required.
"""
from flask_cors import CORS
import json
import os
import stripe
# This is a sample test API key. Sign in to see examples pre-filled with your key.
stripe.api_key = "sk_test_tHhhT6BsG05wQjFXGjc2NtMl00yBTAMcft"

from flask import Flask, render_template, jsonify, request


app = Flask(__name__, static_folder=".",
            static_url_path="", template_folder=".")
CORS(app)

def calculate_order_amount(items):
    # Replace this constant with a calculation of the order's amount
    # Calculate the order total on the server to prevent
    # people from directly manipulating the amount on the client
    return 1400


@app.route('/create-payment-intent', methods=['POST'])
def create_payment():
    try:
        data = json.loads(request.data)
        intent = stripe.PaymentIntent.create(
            amount=calculate_order_amount(data['items']),
            currency='usd'
        )

        return jsonify({
          'clientSecret': intent['client_secret']
        })
    except Exception as e:
        return jsonify(error=str(e)), 403

if __name__ == '__main__':
    app.run()
