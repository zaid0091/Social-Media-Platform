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
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

    // Forward request to backend
    const response = await axios.post(`${backendUrl}/auth/login/`, body, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('[Next.js Login Proxy] Django response status:', response.status);
    const data = response.data;
    const setCookieHeaders = response.headers['set-cookie'];
    console.log('[Next.js Login Proxy] set-cookie headers from Django:', setCookieHeaders);

    const nextResponse = NextResponse.json(data, { status: 200 });

    // Forward set-cookie headers to the browser client (for HttpOnly refresh tokens)
    if (setCookieHeaders) {
      console.log('[Next.js Login Proxy] Forwarding set-cookie headers to browser');
      setCookieHeaders.forEach(cookie => {
        const parsed = parseSetCookie(cookie);
        if (parsed) {
          nextResponse.cookies.set(parsed.name, parsed.value, parsed.options);
        }
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('[Next.js Login Proxy] Error:', error.message, error.response?.data);
    return NextResponse.json(
      error.response?.data || { error: 'Authentication failed' },
      { status: error.response?.status || 500 }
    );
  }
}
