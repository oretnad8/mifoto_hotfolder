
const { MercadoPagoConfig, Preference } = require('mercadopago');

const accessToken = 'TEST-4356966745485069-122518-e4ac9a1dc1baaf8de2fb07159a8677ca-140267706';
const client = new MercadoPagoConfig({ accessToken });

async function testPreference() {
    console.log("Testing Mercado Pago Preference Creation (Attempt 1: With auto_return)...");
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: [
                    {
                        id: 'test-item',
                        title: 'Test Item',
                        quantity: 1,
                        unit_price: 100
                    }
                ],
                back_urls: {
                    success: 'http://localhost:3000/success',
                    failure: 'http://localhost:3000/failure',
                    pending: 'http://localhost:3000/pending'
                },
                auto_return: 'approved'
            }
        });

        console.log("Success (With auto_return)!");
        console.log("Init Point:", result.init_point);
    } catch (error) {
        console.error("FAILED (With auto_return).");
        // Log the pertinent parts of the error
        console.error(JSON.stringify(error, null, 2));
    }

    console.log("\nTesting Mercado Pago Preference Creation (Attempt 2: WITHOUT auto_return)...");
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: [
                    {
                        id: 'test-item-2',
                        title: 'Test Item 2',
                        quantity: 1,
                        unit_price: 100
                    }
                ],
                back_urls: {
                    success: 'http://localhost:3000/success',
                    failure: 'http://localhost:3000/failure',
                    pending: 'http://localhost:3000/pending'
                }
            }
        });

        console.log("Success (WITHOUT auto_return)!");
        console.log("Init Point:", result.init_point);
    } catch (error) {
        console.error("FAILED (WITHOUT auto_return).");
        console.error(JSON.stringify(error, null, 2));
    }
}

testPreference();
