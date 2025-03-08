import { NextResponse } from "next/server";
import { getItemLimit } from "@/app/services/shopeeService";

export async function GET(req: Request) {
  try {
    // Ambil shopId dari query parameter
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { 
          error: "bad_request",
          message: "Parameter shopId diperlukan" 
        },
        { status: 400 }
      );
    }

    const response = await getItemLimit(parseInt(shopId));

    if (response.error) {
      return NextResponse.json(
        { 
          error: response.error,
          message: response.message 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching item limit:", error);
    return NextResponse.json(
      { 
        error: "internal_server_error",
        message: "Gagal mengambil limit produk"
      },
      { status: 500 }
    );
  }
}
