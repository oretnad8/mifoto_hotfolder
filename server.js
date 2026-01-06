const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 443;

// 'dir' is crucial when CWD (resources) != __dirname (app.asar)
const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

// Determine certs path: prefer RESOURCES_PATH (prod), fallback to __dirname (dev)
const certsDir = process.env.RESOURCES_PATH
    ? path.join(process.env.RESOURCES_PATH, 'certs')
    : path.join(__dirname, 'certs');

console.log(`[Server] Looking for certs in: ${certsDir}`);

const certs = {
    key: path.join(certsDir, 'key.pem'),
    cert: path.join(certsDir, 'cert.pem')
};

// Check if certs exist
if (!fs.existsSync(certs.key) || !fs.existsSync(certs.cert)) {
    console.error(`
    [HTTPS Error] SSL Certificates not found!
    Expected at: 
      - ${certs.key}
      - ${certs.cert}
    
    Please generate them or use the default dev server.
    `);
    process.exit(1);
}

const httpsOptions = {
    key: fs.readFileSync(certs.key),
    cert: fs.readFileSync(certs.cert),
};

app.prepare().then(() => {
    const server = createServer(httpsOptions, async (req, res) => {
        try {
            // Be sure to pass `true` as the second argument to `url.parse`.
            // This tells it to parse the query portion of the URL.
            const parsedUrl = parse(req.url, true);
            const { pathname } = parsedUrl;

            // FIX: Serve dynamic uploads (branding) from UserData
            if (pathname.startsWith('/uploads/')) {
                // process.env.APPDATA works on Windows. 
                // We use a fixed subfolder 'localfoto-hotfolder/uploads' to match saving logic.
                const uploadsDir = path.join(process.env.APPDATA, 'localfoto-hotfolder', 'uploads');
                const filePath = path.join(uploadsDir, pathname.replace('/uploads/', ''));

                if (fs.existsSync(filePath)) {
                    res.writeHead(200);
                    fs.createReadStream(filePath).pipe(res);
                    return;
                }
            }

            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    server.listen(port, hostname, (err) => {
        if (err) throw err;
        console.log(`> Ready on https://${hostname}:${port} (and 0.0.0.0)`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`
          [Server Error] Port ${port} is already in use!
          
          Possible causes:
          1. IIS or Apache is running.
          2. Laragon/XAMPP is running.
          3. Another instance of this app is running.
          
          Please stop the conflicting service and try again.
          `);
            process.exit(1);
        } else {
            console.error(err);
        }
    });
});
