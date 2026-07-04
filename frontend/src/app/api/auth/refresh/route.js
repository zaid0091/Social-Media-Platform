import { NextResponse } from 'next/server';
import axios from 'axios';

function parseSetCookie(cookieStr) {
  const parts = cookieStr.split(';');
  const [nameVal, ...restParts] = parts;
  const eqIdx = nameVal.indexOf('=');
  if (eqIdx === -1) return null;
  const name = nameVal.substring(0, eqIdx).trim();
  const value = nameVal.substring(eqIdx + 1).trim();
  
  const options = {};
  restParts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eqIdx = trimmed.indexOf('=');
    let key = trimmed;
    let val = '';
    if (eqIdx !== -1) {
      key = trimmed.substring(0, eqIdx).trim();
      val = trimmed.substring(eqIdx + 1).trim();
    }
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'path') options.path = val;
    else if (lowerKey === 'max-age') options.maxAge = parseInt(val, 10);
    else if (lowerKey === 'httponly') options.httpOnly = true;
    else if (lowerKey === 'secure') options.secure = true;
    else if (lowerKey === 'samesite') {
      const lowered = val.toLowerCase();
      options.sameSite = lowered === 'lax' || lowered === 'strict' || lowered === 'none' ? lowered : 'lax';
    }
  });
  return { name, value, options };
}

export async function POST(request) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
    
    // Extract cookies from browser request to forward to Django backend
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('[Next.js Refresh Proxy] Incoming cookies from browser:', cookieHeader);

    // Call SimpleJWT token refresh view
    const response = await axios.post(`${backendUrl}/auth/token/refresh/`, {}, {
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      }
    });

    console.log('[Next.js Refresh Proxy] Django response status:', response.status);
    const data = response.data; // contains access token: { "access": "..." }
    const setCookieHeaders = response.headers['set-cookie'];
    console.log('[Next.js Refresh Proxy] set-cookie headers from Django:', setCookieHeaders);

    const nextResponse = NextResponse.json(data, { status: 200 });

    // Forward any new set-cookie headers (if simplejwt rotates the refresh token)
    if (setCookieHeaders) {
      setCookieHeaders.forEach(cookie => {
        const parsed = parseSetCookie(cookie);
        if (parsed) {
          nextResponse.cookies.set(parsed.name, parsed.value, parsed.options);
        }
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('[Next.js Refresh Proxy] Error:', error.message, error.response?.data);
    return NextResponse.json(
      error.response?.data || { error: 'Refresh failed' },
      { status: error.response?.status || 401 }
    );
  }
}
