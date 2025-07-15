const { google } = require("googleapis");

// Helper to create OAuth2 client
function getOAuth2Client(tokens) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

// Helper to send email via Gmail API
async function sendMail({ tokens, to, subject, body, from }) {
  const oAuth2Client = getOAuth2Client(tokens);
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  // Construct RFC822 message
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  const message = messageParts.join("\r\n");
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Send the email
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
    },
  });
}

module.exports = { sendMail };
