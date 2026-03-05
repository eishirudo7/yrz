import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { perubahanPesanan as ppSchema } from "@/db/schema/perubahanPesanan";
import { eq, inArray, desc, count, and } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = req.nextUrl;
        const shopsStr = searchParams.get('shops');
        const statusFilter = searchParams.get('statusFilter');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '21');
        const offset = (page - 1) * limit;

        if (!shopsStr) {
            return NextResponse.json({ success: true, data: [], count: 0 });
        }

        const shops = shopsStr.split(',');

        // Base specific conditions
        const conditions = [];
        conditions.push(inArray(ppSchema.shopId, shops));

        if (statusFilter && statusFilter !== 'semua') {
            conditions.push(eq(ppSchema.status, statusFilter));
        }

        // Build query to fetch count and limited data
        // First, count total
        let totalCount = 0;

        // Applying AND logic to conditions if there are any
        const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db.select({ value: count() }).from(ppSchema).where(whereCondition);
        totalCount = countResult[0].value;

        const ppList = await db.select({
            id: ppSchema.id,
            id_pengguna: ppSchema.idPengguna,
            nama_toko: ppSchema.namaToko,
            nomor_invoice: ppSchema.nomorInvoice,
            perubahan: ppSchema.perubahan,
            created_at: ppSchema.createdAt,
            updated_at: ppSchema.updatedAt,
            status: ppSchema.status,
            status_pesanan: ppSchema.statusPesanan,
            detail_perubahan: ppSchema.detailPerubahan,
            shop_id: ppSchema.shopId,
            msg_id: ppSchema.msgId,
            userid: ppSchema.userid
        })
            .from(ppSchema)
            .where(whereCondition)
            .orderBy(desc(ppSchema.createdAt))
            .limit(limit)
            .offset(offset);

        return NextResponse.json({ success: true, count: totalCount, data: ppList });
    } catch (error) {
        console.error('Error fetching perubahan_pesanan list:', error);
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

        const { id, status } = await req.json();

        if (!id || !status) {
            return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        await db.update(ppSchema)
            .set({ status, updatedAt: new Date() })
            .where(eq(ppSchema.id, id));

        return NextResponse.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Error updating status pesanan:', error);
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

        const { searchParams } = req.nextUrl;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
        }

        await db.delete(ppSchema).where(eq(ppSchema.id, parseInt(id)));

        return NextResponse.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error('Error deleting perubahan pesanan:', error);
        return NextResponse.json({ success: false, message: 'Failed to delete' }, { status: 500 });
    }
}
