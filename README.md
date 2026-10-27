# rawj.pro

## Paymob USD checkout

`checkout-usd.html` calls the dedicated `agency-paymob-usd` Cloudflare Worker
only after the customer submits the form. The Worker creates a fresh Paymob
intention and either returns the checkout URL or forwards Paymob's live error.
No Paymob secret is shipped to the browser or stored in this repository.

Required Worker secrets:

- `PAYMOB_SECRET_KEY`
- `PAYMOB_PUBLIC_KEY`
- `PAYMOB_INTEGRATION_ID`
