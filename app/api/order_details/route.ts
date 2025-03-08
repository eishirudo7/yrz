import { supabase } from '@/lib/supabase'

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const order_sn = searchParams.get('order_sn')

    if (user_id && order_sn) {
      return NextResponse.json(
        { error: 'Hanya boleh memberikan salah satu parameter: user_id ATAU order_sn' },
        { status: 400 }
      )
    }

    if (!user_id && !order_sn) {
      return NextResponse.json(
        { error: 'Parameter user_id atau order_sn diperlukan' },
        { status: 400 }
      )
    }

    let data, error

    if (user_id) {
      ({ data, error } = await supabase.rpc('buyer_order_details', { 
        p_buyer_user_id: user_id 
      }))
    } else {
      ({ data, error } = await supabase.rpc('order_details', { 
        p_order_sn: order_sn 
      }))
    }

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: `Gagal mengambil data pesanan: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: `Terjadi kesalahan server: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
