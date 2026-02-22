import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

console.log("JWT_SECRET =", process.env.JWT_SECRET);

const PUBLIC_PATHS = new Set(["/login", "/unauthorized"]);

const shouldBypass = (pathname) => {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/push-sw.js" ||
    pathname === "/sw.js"
  );
};

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
};

const verifyAdminToken = async (token) => {
  const secret = getSecret();
  if (!secret || !token) {
    return null;
  }

  try {
    const result = await jwtVerify(token, secret);
    console.log("Token verified successfully:", result);
    const role = result.payload?.role;
    const id = result.payload?.id;

    if (!id) {
      return null;
    }

    return {
      id,
      role,
    };
  } catch (_) {
    return null;
  }
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('accessToken')?.value;
  console.log("Extracted token from cookies:", token);
  const auth = await verifyAdminToken(token);

  if (pathname === "/login") {
    if (auth?.role === "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (auth.role !== "ADMIN" && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (PUBLIC_PATHS.has(pathname) && auth.role === "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"],
};
