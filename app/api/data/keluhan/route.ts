import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { keluhan as keluhanSchema } from "@/db/schema/keluhan";
import { eq, inArray, desc } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = req.nextUrl.searchParams;
        const shopsStr = searchParams.get('shops');

        if (!shopsStr) {
            return NextResponse.json({ success: true, data: [] });
        }

        const shops = shopsStr.split(',');

        const keluhanList = await db.select({
            id: keluhanSchema.id,
            id_pengguna: keluhanSchema.idPengguna,
            nama_toko: keluhanSchema.namaToko,
            jenis_keluhan: keluhanSchema.jenisKeluhan,
            nomor_invoice: keluhanSchema.nomorInvoice,
            create_at: keluhanSchema.createAt,
            status_keluhan: keluhanSchema.statusKeluhan,
            deskripsi_keluhan: keluhanSchema.deskripsiKeluhan,
            status_pesanan: keluhanSchema.statusPesanan,
            shop_id: keluhanSchema.shopId,
            msg_id: keluhanSchema.msgId,
            userid: keluhanSchema.userid,
            updated_at: keluhanSchema.updatedAt
        })
            .from(keluhanSchema)
            .where(inArray(keluhanSchema.shopId, shops))
            .orderBy(desc(keluhanSchema.createAt))
            .limit(20);

        return NextResponse.json({ success: true, data: keluhanList });
    } catch (error) {
        console.error('Error fetching keluhan list:', error);
        return NextResponse.json({ success: false, message: 'Error fetching data' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { id, status_keluhan } = await req.json();

        if (!id || !status_keluhan) {
            return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        await db.update(keluhanSchema)
            .set({ statusKeluhan: status_keluhan })
            .where(eq(keluhanSchema.id, id));

        return NextResponse.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Error updating status keluhan:', error);
        return NextResponse.json({ success: false, message: 'Failed to update' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = req.nextUrl.searchParams;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
        }

        await db.delete(keluhanSchema).where(eq(keluhanSchema.id, parseInt(id)));

        return NextResponse.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error('Error deleting keluhan:', error);
        return NextResponse.json({ success: false, message: 'Failed to delete' }, { status: 500 });
    }
}
