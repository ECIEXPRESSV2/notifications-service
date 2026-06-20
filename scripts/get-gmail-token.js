/**
 * Script de un solo uso para obtener el refresh token de Gmail API.
 *
 * Antes de ejecutar, asegúrate de tener en el .env:
 *   GMAIL_CLIENT_ID=...
 *   GMAIL_CLIENT_SECRET=...
 *
 * Ejecutar: node -r dotenv/config scripts/get-gmail-token.js
 */
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan GMAIL_CLIENT_ID o GMAIL_CLIENT_SECRET en el .env');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
  prompt: 'consent',
});

console.log('\nAbre este URL en tu navegador:\n');
console.log(authUrl);
console.log('\nEsperando autorizacion en http://localhost:3333 ...\n');

const server = http.createServer(async (req, res) => {
  const { query } = url.parse(req.url, true);

  if (!query.code) {
    res.end('Sin codigo. Intenta de nuevo.');
    return;
  }

  res.end('<h2>Autorizado. Revisa la terminal.</h2>');

  try {
    const { tokens } = await oAuth2Client.getToken(query.code);
    console.log('\nAgrega esta variable a tu .env y a Render:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (err) {
    console.error('Error al obtener tokens:', err.message);
  }

  server.close();
});

server.listen(3333);
