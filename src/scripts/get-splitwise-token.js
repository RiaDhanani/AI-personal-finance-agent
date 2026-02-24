import axios from 'axios';

// STEP 1: Get a fresh authorization code by visiting this URL in your browser:
// https://secure.splitwise.com/oauth/authorize?response_type=code&client_id=X9GO0QzLgKfCdQ7zO4L8DXwHQPTkJplgBHOGUF6R&redirect_uri=http://localhost:3000/callback

// STEP 2: Paste the code from the URL below:
const code = 'PASTE_YOUR_CODE_HERE';

// Your credentials
const consumerKey = 'YOUR_CONSUMER_KEY'; // Replace with your actual consumer key
const consumerSecret = 'YOUR_CONSUMER_SECRET'; // Replace with your actual consumer secret
const redirectUri = 'http://localhost:3000/callback';

async function getToken() {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', consumerKey);
    params.append('client_secret', consumerSecret);
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    console.log('Requesting access token...\n');

    const response = await axios.post(
      'https://secure.splitwise.com/oauth/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('SUCCESS! Your access token:\n');
    console.log(response.data.access_token);
    console.log('\nAdd this to your .env file:\n');
    console.log('SPLITWISE_API_KEY=' + response.data.access_token + '\n');

    // Test the token
    console.log('Testing token...');
    const testResponse = await axios.get(
      'https://secure.splitwise.com/api/v3.0/get_current_user',
      {
        headers: {
          'Authorization': 'Bearer ' + response.data.access_token
        }
      }
    );

    console.log('Token works! Logged in as: ' + testResponse.data.user.first_name + ' ' + testResponse.data.user.last_name);
    console.log('Email: ' + testResponse.data.user.email + '\n');

  } catch (error) {
    console.error('\nError:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data.error === 'invalid_grant') {
        console.error('\nThe authorization code expired or was already used.');
        console.error('Get a fresh code from this URL:');
        console.error('https://secure.splitwise.com/oauth/authorize?response_type=code&client_id=X9GO0QzLgKfCdQ7zO4L8DXwHQPTkJplgBHOGUF6R&redirect_uri=http://localhost:3000/callback');
      }
    } else {
      console.error(error.message);
    }
  }
}

getToken();