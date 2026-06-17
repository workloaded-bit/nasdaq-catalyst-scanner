// netlify/functions/tweet.js

const crypto = require('crypto');

const X_CREDENTIALS = {
  consumer_key: '1B5yrx6GxUHqDcZZ8sjFiNXX0',
  consumer_secret: '9YBqG0U2CB8gsVHSzW7EFOqcAXrft3klwUdfmLUVc60usIf2Cf',
  access_token: '1499230342871457798-hbpFdqba4fvzrAu31vVshm7CNzRyG8',
  access_token_secret: '53pjdb5SMM1t1rwCi0ERpcBBQaxv3029DWISdtkyqvNG0'
};

function generateSignature(method, url, params, credentials) {
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(
      Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&')
    )
  ].join('&');

  const signingKey = encodeURIComponent(credentials.consumer_secret) + '&' + 
                     encodeURIComponent(credentials.access_token_secret);

  return crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
}

function buildAuthHeader(method, url, params, credentials) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(32).toString('hex');

  const oauthParams = {
    oauth_consumer_key: credentials.consumer_key,
    oauth_token: credentials.access_token,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };

  const allParams = { ...oauthParams, ...params };
  const signature = generateSignature(method, url, allParams, credentials);
  oauthParams.oauth_signature = signature;

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { text } = JSON.parse(event.body || '{}');

    if (!text || text.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Tweet text required' })
      };
    }

    const tweetText = text.substring(0, 280);
    const url = 'https://api.twitter.com/2/tweets';

    const authHeader = buildAuthHeader('POST', url, { text: tweetText }, X_CREDENTIALS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Nasdaq-Catalyst-Scanner'
      },
      body: JSON.stringify({ text: tweetText })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('X API error:', data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Failed to post', details: data })
      };
    }

    console.log('Tweet posted:', data.data?.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tweetId: data.data?.id,
        text: tweetText
      })
    };

  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', message: error.message })
    };
  }
};
