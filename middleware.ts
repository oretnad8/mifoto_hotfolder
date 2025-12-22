import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Protect /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const basicAuth = request.headers.get('authorization');

        if (basicAuth) {
            const authValue = basicAuth.split(' ')[1];
            const [user, pwd] = atob(authValue).split(':');

            // Check against env variables (user 'admin', password from ADMIN_TOKEN or new var)
            // Using 'admin' as default user and ADMIN_TOKEN as password
            if (user === 'admin' && pwd === process.env.ADMIN_TOKEN) {
                return NextResponse.next();
            }
        }

        return new NextResponse('Authentication Required', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Secure Area"',
            },
        });
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/admin/:path*',
};
