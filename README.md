# rawj.pro

## Paymob international currency test

The public checkout page never contains Paymob secret credentials. A manually
triggered GitHub Actions workflow sends a test-mode intention request and
publishes only the sanitized response to `paymob-test-result.json`.

Required repository secrets:

- `PAYMOB_TEST_SECRET_KEY`
- `PAYMOB_TEST_PUBLIC_KEY`
- `PAYMOB_TEST_INTEGRATION_ID`
