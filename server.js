const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Your InfinityFree API endpoint
const TARGET_API = 'https://gandakitech.com.np/smart_bell/api/get_device_data.php';

// Simple in-memory cookie storage
let sessionCookies = '';

app.get('/api/device/:deviceId', async (req, res) => {
  try {
    console.log(`\n--- Proxying request for device: ${req.params.deviceId} ---`);
    
    // First request - might get challenge page
    const firstResponse = await axios.get(TARGET_API, {
      params: {
        device_id: req.params.deviceId,
        t: Date.now(),
        _: Date.now()
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://gandakitech.com.np/',
        'Origin': 'https://gandakitech.com.np',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      maxRedirects: 0, // Don't auto-follow redirects
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept all status codes
      }
    });

    // Store cookies from response
    const setCookie = firstResponse.headers['set-cookie'];
    if (setCookie) {
      sessionCookies = setCookie.join('; ');
      console.log('Cookies stored:', sessionCookies);
    }

    // Check if we got HTML (challenge page)
    const responseData = firstResponse.data;
    const isHTML = typeof responseData === 'string' && 
                   (responseData.includes('<!DOCTYPE') || responseData.includes('<html'));

    if (isHTML) {
      console.log('⚠ Received challenge page, extracting redirect...');
      
      // Extract redirect URL from JavaScript
      const redirectMatch = responseData.match(/location\.href="([^"]+)"/);
      
      if (redirectMatch && redirectMatch[1]) {
        const redirectUrl = redirectMatch[1];
        console.log('Following redirect to:', redirectUrl);
        
        // Follow redirect with cookies
        const finalResponse = await axios.get(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Cookie': sessionCookies
          },
          maxRedirects: 5
        });
        
        console.log('Final response status:', finalResponse.status);
        
        // Send the JSON data
        if (typeof finalResponse.data === 'object') {
          return res.json(finalResponse.data);
        } else {
          try {
            const jsonData = JSON.parse(finalResponse.data);
            return res.json(jsonData);
          } catch (e) {
            return res.send(finalResponse.data);
          }
        }
      }
    }
    
    // If we got JSON directly
    return res.json(firstResponse.data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // More detailed error response
    res.status(500).json({ 
      error: 'Failed to fetch device data',
      details: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
  }
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  try {
    const response = await axios.get('https://gandakitech.com.np', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    res.json({ 
      status: 'connected', 
      code: response.status 
    });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Smart Pale Dai Proxy Server - Use /api/device/[deviceId]');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
