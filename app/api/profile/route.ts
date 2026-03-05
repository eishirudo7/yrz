// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';
import { db } from '@/db';
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name'),
  phone: text('phone'),
  profileImage: text('profile_image'),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Dapatkan user yang sedang login
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: "Pengguna tidak terautentikasi"
      }, { status: 401 });
    }

    // Ambil metadata user (profil)
    let profile = null;
    try {
      const profileData = await db.select({
        display_name: profiles.displayName,
        phone: profiles.phone,
        profile_image: profiles.profileImage
      })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      profile = profileData[0];
    } catch (profileError: any) {
      if (profileError.code !== 'PGRST116') { // PGRST116 = tidak ada data
        console.error('Error fetching profile:', profileError);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        email_verified: user.email_confirmed_at ? true : false,
        name: profile?.display_name || user.user_metadata?.display_name || '',
        phone: profile?.phone || user.user_metadata?.phone || '',
        profile_image: profile?.profile_image || null,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({
      success: false,
      message: "Terjadi kesalahan saat memproses permintaan",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}