import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
    
    // Extract cookies from browser request to forward to Django backend
    const cookieHeader = request.headers.get('cookie') || '';

    // Call SimpleJWT token refresh view
    const response = await axios.post(`${backendUrl}/auth/token/refresh/`, {}, {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      }
    });

    const data = response.data; // contains access token: { "access": "..." }
    const setCookieHeaders = response.headers['set-cookie'];

    const nextResponse = NextResponse.json(data, { status: 200 });

    // Forward any new set-cookie headers (if simplejwt rotates the refresh token)
    if (setCookieHeaders) {
      setCookieHeaders.forEach(cookie => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      error.response?.data || { error: 'Refresh failed' },
      { status: error.response?.status || 401 }
    );
  }
}
