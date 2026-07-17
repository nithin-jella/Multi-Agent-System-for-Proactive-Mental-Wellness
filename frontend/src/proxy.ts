import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
export async function proxy(request: NextRequest) {
  const session = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  const pathname = request.nextUrl.pathname;

  // Admin routes protection - require admin role
  if (pathname.startsWith('/admin/dashboard')) {
    if (!session || session.role !== "admin") {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Redirect authenticated users away from login pages
  if ((pathname.startsWith('/signin') || pathname.startsWith('/signin-ugm')) && session) {
    return NextResponse.redirect(new URL('/aika', request.url));
  }

  // Protect routes that require authentication
  if (pathname.startsWith('/aika') && !session) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  return NextResponse.next();
}

// See: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ['/admin/dashboard/:path*', '/signin', '/signin-ugm', '/aika/:path*'],
};
