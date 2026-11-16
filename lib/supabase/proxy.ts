// Runs before every page request (called from /proxy.ts).
// 1. Keeps the user's login session fresh.
// 2. Sends logged-out users to /login, and logged-in users away from /login and /signup.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGES = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Don't put any code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;

  const path = request.nextUrl.pathname;
  const isPublicPage = PUBLIC_PAGES.some((page) => path.startsWith(page));

  if (!isLoggedIn && !isPublicPage) {
    return redirectTo(request, response, "/login");
  }
  if (isLoggedIn && isPublicPage) {
    return redirectTo(request, response, "/");
  }

  return response;
}

// Redirect, but keep any refreshed session cookies.
function redirectTo(request: NextRequest, response: NextResponse, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
