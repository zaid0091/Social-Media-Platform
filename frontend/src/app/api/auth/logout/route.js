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

  // Clear the HttpOnly cookie using native Next.js API for both potential variants
  nextResponse.cookies.delete('refresh_token');
  nextResponse.cookies.delete('refreshtoken');

  return nextResponse;
}
