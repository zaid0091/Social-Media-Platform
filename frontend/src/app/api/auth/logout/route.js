import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
    
    // Read cookie headers from original request to forward to Django
    const cookieHeader = request.headers.get('cookie') || '';

    // Forward request to backend
    await axios.post(`${backendUrl}/auth/logout/`, {}, {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    // Fail silently to guarantee client state gets cleared
  }

  const nextResponse = NextResponse.json({ success: true }, { status: 200 });

  // Clear the HttpOnly cookie by setting an expired date
  // Standard refresh token cookie name is configured as JWT_COOKIE_NAME in backend (refreshtoken)
  nextResponse.headers.append(
    'Set-Cookie',
    'refreshtoken=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );

  return nextResponse;
}
