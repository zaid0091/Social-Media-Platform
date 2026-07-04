import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

    // Forward request to backend
    const response = await axios.post(`${backendUrl}/auth/login/`, body, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = response.data;
    const setCookieHeaders = response.headers['set-cookie'];

    const nextResponse = NextResponse.json(data, { status: 200 });

    // Forward set-cookie headers to the browser client (for HttpOnly refresh tokens)
    if (setCookieHeaders) {
      setCookieHeaders.forEach(cookie => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      error.response?.data || { error: 'Authentication failed' },
      { status: error.response?.status || 500 }
    );
  }
}
