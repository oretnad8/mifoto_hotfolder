const axios = require('axios');

const LICENSE_API_URL = 'http://dantero.ddns.net:3333/api/validate';
const licenseKey = "89cc60f3-797f-4d8c-99f9-320bb8a611ea";
const hwid = "de3efddbe2657cceacb87f3a11d5705738a85cc6147a5427d7cc6eded157e0a5";
const localIp = "192.168.1.11"; // Mock IP

async function testServer() {
    console.log(`Testing connection to ${LICENSE_API_URL}...`);
    try {
        const response = await axios.post(LICENSE_API_URL, {
            licenseKey,
            hwid,
            localIp
        }, { timeout: 10000 });

        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testServer();
