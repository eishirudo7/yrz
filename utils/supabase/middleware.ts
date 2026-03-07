import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Array halaman yang memerlukan akses Pro
const PRO_ONLY_PAGES = [
  '/ubah_pesanan',
  '/keluhan',
  '/otp',
  '/pengaturan'
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userPlan = 'basic'; // Default ke basic jika tidak ada subscription

  if (user) {
    // Hindari rekursi pemanggilan API berulang-ulang ketika middleware sudah ada di dalam request /api/user/data
    if (!request.nextUrl.pathname.startsWith('/api')) {
      try {
        // Panggil API internal (Drizzle ORM) untuk mendapatkan data toko & subscription
        // Kita pass header cookie dari request saat ini supaya bisa terbaca sesinya di server
        const apiUrl = new URL('/api/user/data', request.url);
        const apiResponse = await fetch(apiUrl.toString(), {
          headers: {
            cookie: request.headers.get('cookie') || '',
          },
        });

        if (apiResponse.ok) {
          const { shops, subscription } = await apiResponse.json();

          if (shops && shops.length > 0) {
            // Store shop IDs in cookie (minimal data untuk referensi)
            const shopIds = shops.map((shop: any) => shop.shop_id);

            // Untuk lookup cepat di client, simpan juga mapping ID ke nama
            const shopData = shops.reduce((acc: Record<number, string>, shop: any) => {
              acc[shop.shop_id] = shop.shop_name;
              return acc;
            }, {});

            supabaseResponse.cookies.set('user_shop_ids', JSON.stringify(shopIds), {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 8, // 8 jam
              path: '/'
            });

            // Simpan mapping shop_id->name untuk UI (tidak sensitif)
            supabaseResponse.cookies.set('user_shop_names', JSON.stringify(shopData), {
              httpOnly: false, // Bisa diakses oleh JS client
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 8, // 8 jam
              path: '/'
            });
          }

          if (subscription) {
            const planName = subscription.plan_name || 'basic';
            userPlan = planName.toLowerCase();

            // Simpan jenis paket di cookie untuk referensi cepat
            supabaseResponse.cookies.set('user_plan', userPlan, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 8, // 8 jam
              path: '/'
            });
          }
        }
      } catch (error) {
        console.error("Error saat fetch user data dan simpan cookie di middleware:", error);
        // Error handling, tapi tetap lanjutkan proses
      }

      // Cek apakah pengguna mencoba mengakses halaman khusus Pro tanpa paket Pro
      const isPro = userPlan === 'admin';
      const currentPath = request.nextUrl.pathname;
      const isProOnlyPage = PRO_ONLY_PAGES.some(page => currentPath.startsWith(page));

      if (isProOnlyPage && !isPro) {
        // Redirect ke halaman profile jika mencoba akses halaman khusus Pro tanpa paket Pro
        const url = request.nextUrl.clone();
        url.pathname = '/profile';
        url.searchParams.set('upgrade', 'true');
        return NextResponse.redirect(url);
      }
    } // Akhir dari if (!...startsWith('/api'))
  } // Akhir dari if (user)

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/api')
  ) {
    // Redirect jika tidak login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}