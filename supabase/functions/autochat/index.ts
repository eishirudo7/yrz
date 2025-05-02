import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from "https://esm.sh/openai@4.0.0"
import { logger } from "./logger.ts"

// Types dan interfaces
interface Config {
  openai_api: string;
  openai_model: string;
  openai_temperature: number;
  openai_prompt: string;
}

interface ChatStatus {
  shop_id: string;
  status_chat: boolean;
}

interface OrderData {
  order_sn: string;
  order_status: string;
  is_printed: boolean;
  create_time: number;
  total_amount: number;
}

interface ChatMessage {
  message_id: string;
  from_shop_id: string;
  content: {
    text?: string;
  };
  message_type: string;
}

interface ChatData {
  to_id: string;
  to_name: string;
  conversation_id: string;
  shop_id: string;
  latest_message_id: string;
  latest_message_content: {
    text: string;
  };
  shop_name: string;
}

// Inisialisasi Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Fungsi untuk setup logging
async function setupLogging() {
  await logger.info("==========================================Program dimulai==========================================")
}

// Fungsi untuk mendapatkan konfigurasi
async function getConfig() {
  try {
    const { data, error } = await supabase
      .from('pengaturan')
      .select('*')
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error saat mengambil config:", error)
    return null
  }
}

// Fungsi untuk mendapatkan status chat
async function getChatStatus() {
  try {
    const { data, error } = await supabase
      .from('auto_ship_chat')
      .select('shop_id, status_chat')

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error saat mengambil chat status:", error)
    return null
  }
}

// Fungsi untuk menangani keluhan
async function tanganiKeluhan(
  id_pengguna: string,
  nama_toko: string,
  jenis_keluhan: string,
  deskripsi_keluhan: string,
  nomor_invoice: string,
  status_pesanan: string,
  store_id: string,
  msg_id: string,
  user_id: string
) {
  try {
    const { data, error } = await supabase
      .from('keluhan')
      .upsert({
        id_pengguna,
        nama_toko,
        jenis_keluhan,
        deskripsi_keluhan,
        nomor_invoice,
        status_pesanan,
        shop_id: store_id,
        msg_id,
        userid: user_id
      }, { onConflict: 'nomor_invoice' })

    if (error) throw error
    console.log("Data keluhan berhasil dimasukkan:", data)
    return true
  } catch (error) {
    console.error("Terjadi kesalahan saat memasukkan data keluhan:", error)
    return false
  }
}

// Fungsi untuk mengubah detail pesanan
async function ubahDetailPesanan(
  id_pengguna: string,
  nama_toko: string,
  nomor_invoice: string,
  detail_perubahan: string,
  perubahan: any,
  status_pesanan: string,
  store_id: string,
  msg_id: string,
  user_id: string
) {
  try {
    const { data, error } = await supabase
      .from('perubahan_pesanan')
      .upsert({
        id_pengguna,
        nama_toko,
        nomor_invoice,
        detail_perubahan,
        perubahan,
        status_pesanan,
        shop_id: store_id,
        msg_id,
        userid: user_id
      }, { onConflict: 'nomor_invoice' })

    if (error) throw error
    console.log("Data perubahan pesanan berhasil dimasukkan:", data)
    return true
  } catch (error) {
    console.error("Terjadi kesalahan saat memasukkan data perubahan pesanan:", error)
    return false
  }
}

// Fungsi untuk login
async function login() {
  try {
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: "fariz.uchiha@gmail.com",
      password: "4Nsatsu_"
    })

    if (error) throw error

    await logger.info("=== Login Berhasil ===")
    await logger.info(`User ID: ${session.user.id}`)
    await logger.info(`Email: ${session.user.email}`)
    await logger.info("=====================\n")

    return session
  } catch (error) {
    await logger.error(`Error saat login: ${error}`)
    return null
  }
}

// Helper untuk mendapatkan auth cookies dan headers
async function getAuthConfig(session: any) {
  try {
    // Buat session data lengkap
    const session_data = {
      access_token: session.access_token,
      token_type: session.token_type,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      user: {
        id: session.user.id,
        aud: session.user.aud,
        role: session.user.role,
        email: session.user.email,
        email_confirmed_at: session.user.email_confirmed_at,
        phone: session.user.phone,
        confirmed_at: session.user.confirmed_at,
        last_sign_in_at: session.user.last_sign_in_at,
        app_metadata: session.user.app_metadata,
        user_metadata: session.user.user_metadata,
        identities: [
          {
            id: session.user.id,
            user_id: session.user.id,
            identity_data: {
              email: session.user.email,
              email_verified: true
            },
            provider: "email",
            email: session.user.email
          }
        ],
        created_at: session.user.created_at,
        updated_at: session.user.updated_at,
        is_anonymous: false
      }
    }

    // Encode session data ke base64
    const session_json = JSON.stringify(session_data)
    const session_base64 = btoa(session_json)

    // Buat cookies untuk autentikasi
    const cookies = {
      'sb-jsitzrpjtdorcdxencxm-auth-token': `base64-${session_base64}`,
      'next-auth.session-token': session.refresh_token
    }

    // Headers tanpa Authorization
    const headers = {
      'Accept': '*/*',
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      'Referer': 'https://yorozuya.me/webchat',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Sec-Fetch-Mode': 'cors',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive'
    }

    return { cookies, headers }
  } catch (error) {
    await logger.error(`Error dalam getAuthConfig: ${error}`)
    return null
  }
}

// Update fungsi jalankanProsesOrder
async function jalankanProsesOrder(session: any) {
  const url = "https://yorozuya.me/api/proses_order"
  try {
    const auth = await getAuthConfig(session)
    if (!auth) {
      throw new Error("Gagal mendapatkan konfigurasi auth")
    }

    const { cookies, headers } = auth

    // Convert cookies object to string
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    const response = await fetch(url, {
      headers: {
        ...headers,
        'Cookie': cookieString
      }
    })

    if (response.ok) {
      await logger.info("✅ Berhasil menjalankan proses order di server")
      return true
    }
    
    await logger.error(`❌ Gagal menjalankan proses order. Status code: ${response.status}`)
    return false
  } catch (error) {
    await logger.error(`❌ Terjadi kesalahan saat menjalankan proses order: ${error}`)
    return false
  }
}

// Update fungsi ambilDataPesananShopee
async function ambilDataPesananShopee(user_id: string, config: any) {
  const url = `https://yorozuya.me/api/order_details?user_id=${user_id}`
  try {
    const auth = await getAuthConfig(config)
    if (!auth) {
      throw new Error("Gagal mendapatkan konfigurasi auth")
    }

    const { cookies, headers } = auth

    // Convert cookies object to string
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    const response = await fetch(url, {
      headers: {
        ...headers,
        'Cookie': cookieString
      }
    })

    if (response.ok) {
      const data = await response.json()
      if (data.data && data.data.length > 0) {
        return data
      }
    }
    return null
  } catch (error) {
    await logger.error(`Error saat mengambil data pesanan: ${error}`)
    return null
  }
}

// Update fungsi cekKeluhanDanPerubahan
async function cekKeluhanDanPerubahan(user_id: string, config: any) {
  try {
    const url = `https://yorozuya.me/api/cek_perubahan?user_id=${user_id}`
    
    const auth = await getAuthConfig(config)
    if (!auth) {
      throw new Error("Gagal mendapatkan konfigurasi auth")
    }

    const { cookies, headers } = auth

    // Convert cookies object to string
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    const response = await fetch(url, {
      headers: {
        ...headers,
        'Cookie': cookieString
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return {
        ada_keluhan: data.ada_keluhan || false,
        ada_perubahan: data.ada_perubahan || false,
        detail_keluhan: data.keluhan_detail || [],
        detail_perubahan: data.perubahan_detail || [],
        jumlah_keluhan: data.jumlah_keluhan || 0,
        jumlah_perubahan: data.jumlah_perubahan || 0
      }
    }
    return {
      ada_keluhan: false,
      ada_perubahan: false,
      detail_keluhan: [],
      detail_perubahan: [],
      jumlah_keluhan: 0,
      jumlah_perubahan: 0
    }
  } catch (error) {
    await logger.error(`Error saat cek keluhan dan perubahan: ${error}`)
    return {
      ada_keluhan: false,
      ada_perubahan: false,
      detail_keluhan: [],
      detail_perubahan: []
    }
  }
}

// Update fungsi replyToChat
async function replyToChat(chat: any, reply_text: string, config: any) {
  const url = "https://yorozuya.me/api/msg/send_message"

  try {
    if (!chat || typeof chat !== 'object') {
      return null
    }

    const to_id = chat.buyer_id
    const shop_id = chat.shop_id
    const username = chat.username || 'Unknown'

    if (!to_id || !shop_id) {
      return null
    }

    const auth = await getAuthConfig(config)
    if (!auth) {
      throw new Error("Gagal mendapatkan konfigurasi auth")
    }

    const { cookies, headers } = auth

    // Convert cookies object to string
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    const payload = {
      toId: parseInt(to_id),
      messageType: "text",
      content: reply_text,
      shopId: parseInt(shop_id)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Cookie': cookieString
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      return response
    }
    return null
  } catch (error) {
    await logger.error(`Error saat mengirim pesan: ${error}`)
    return null
  }
}

// Update fungsi processConversation
async function processConversation(
  conversation: Array<{ role: string; content: string }>,
  user_id: string,
  ada_pesanan: boolean,
  nomor_pesanan: string | null,
  store_id: string,
  conversation_id: string,
  user_id_int: number,
  jumlah_pesanan: number = 0,
  daftar_pesanan: any[] = [],
  config: Config
) {
  // Inisialisasi OpenAI client
  const openai = new OpenAI({
    apiKey: config.openai_api,
    maxRetries: 3,
    timeout: 30000,
  });

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = {
        model: config.openai_model,
        messages: conversation,
        temperature: config.openai_temperature,
        tools: [
          {
            type: "function",
            function: {
              name: "tangani_keluhan",
              description: "Menangani keluhan pelanggan terkait pesanan pelanggan dan menyimpannya di database",
              parameters: {
                type: "object",
                properties: {
                  id_pengguna: { type: "string" },
                  nama_toko: { type: "string" },
                  status_pesanan: { type: "string" },
                  jenis_keluhan: { 
                    type: "string", 
                    enum: ["Produk Tidak Lengkap", "Produk Rusak"] 
                  },
                  deskripsi_keluhan: { type: "string" },
                  nomor_pesanan: { type: "string" }
                },
                required: ["id_pengguna", "nama_toko", "jenis_keluhan", "deskripsi_keluhan", "nomor_pesanan", "status_pesanan"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "ubah_detail_pesanan",
              description: "Mencatat permintaan perubahan detail pesanan seperti warna atau ukuran",
              parameters: {
                type: "object",
                properties: {
                  id_pengguna: { type: "string" },
                  nama_toko: { type: "string" },
                  nomor_pesanan: { type: "string" },
                  status_pesanan: { 
                    type: "string", 
                    enum: ["IN_CANCEL", "PROCESSED"] 
                  },
                  detail_perubahan: { type: "string" },
                  perubahan: {
                    type: "object",
                    properties: {
                      warna: { type: "string" },
                      ukuran: { type: "string" }
                    }
                  }
                },
                required: ["id_pengguna", "nama_toko", "detail_perubahan", "nomor_pesanan", "perubahan", "status_pesanan"]
              }
            }
          }
        ],
        tool_choice: "auto"
      };

      // Log pesan yang akan dikirim ke OpenAI
      await logger.info("📤 Mengirim request ke OpenAI:")
      await logger.info(`Model: ${config.openai_model}`)
      await logger.info(`Temperature: ${config.openai_temperature}`)
      await logger.info("Messages:")
      conversation.forEach(msg => {
        logger.info(`- ${msg.role}: ${msg.content}`)
      })

      const response = await openai.chat.completions.create(data);
      const message = response.choices[0].message;

      // Log respon dari OpenAI
      await logger.info("📥 Respon dari OpenAI:")
      await logger.info(`Content: ${message.content}`)
      if (message.tool_calls) {
        await logger.info("Tool Calls:")
        message.tool_calls.forEach(call => {
          logger.info(`- Function: ${call.function.name}`)
          logger.info(`  Arguments: ${call.function.arguments}`)
        })
      }

      if (message.tool_calls && ada_pesanan) {
        for (const tool_call of message.tool_calls) {
          const args = JSON.parse(tool_call.function.arguments);
          
          if (tool_call.function.name === 'tangani_keluhan') {
            await tanganiKeluhan(
              args.id_pengguna,
              args.nama_toko,
              args.jenis_keluhan,
              args.deskripsi_keluhan,
              args.nomor_pesanan,
              args.status_pesanan,
              store_id,
              conversation_id,
              user_id_int.toString()
            );
            return `Terima kasih telah memberi tahu kami tentang ${args.jenis_keluhan}. Kami telah mencatat keluhan Anda terkait pesanan dengan nomor pesanan ${nomor_pesanan} dan akan menanganinya sesegera mungkin.`;
          } else if (tool_call.function.name === 'ubah_detail_pesanan') {
            await ubahDetailPesanan(
              args.id_pengguna,
              args.nama_toko,
              args.nomor_pesanan,
              args.detail_perubahan,
              args.perubahan,
              args.status_pesanan,
              store_id,
              conversation_id,
              user_id_int.toString()
            );
            return `Terima kasih telah memberi tahu kami tentang perubahan yang Anda inginkan untuk pesanan dengan nomor pesanan ${args.nomor_pesanan}. Kami telah mencatat perubahan tersebut dan akan menanganinya sesegera mungkin.`;
          }
        }
      }

      return message.content;
    } catch (error) {
      await logger.error(`Attempt ${attempt + 1} failed: ${error}`);
      if (attempt === maxRetries - 1) {
        await logger.error("Failed after all retries");
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  return null;
}

// Update fungsi processChat
async function processChat(
  conversation_id: string,
  shop_id: string,
  to_name: string,
  shop_name: string,
  unread_count: number,
  to_id: string,
  openai: OpenAI,
  config: Config,
  session: any,
  status_chat: ChatStatus[]
) {
  try {
    // Cek status chat untuk shop_id tertentu
    const status_result = status_chat.find(item => item.shop_id === shop_id);
    if (status_result && !status_result.status_chat) {
      await logger.info(`⏭️ Skip membalas chat untuk shop_id ${shop_id} karena status_chat = False`)
      return;
    }

    const userchat = `https://yorozuya.me/api/msg/get_message?conversationId=${conversation_id}&shopId=${shop_id}&pageSize=25`
    await logger.info(`📤 Mengambil pesan dari: ${userchat}`)
    
    const auth = await getAuthConfig(session)
    if (!auth) {
      throw new Error("Gagal mendapatkan konfigurasi auth")
    }

    const { cookies, headers } = auth
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    const response = await fetch(userchat, {
      headers: {
        ...headers,
        'Cookie': cookieString
      }
    })

    if (!response.ok) {
      await logger.error(`❌ Gagal mengambil pesan: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      await logger.error(`Response body: ${errorText}`)
      return
    }

    const conv_data = await response.json()
    if (!conv_data.response?.messages) {
      await logger.error("Struktur response tidak sesuai")
      return
    }

    const messages: ChatMessage[] = conv_data.response.messages
    if (!messages.length) {
      await logger.error("Tidak ada pesan dalam response")
      return
    }

    messages.reverse()

    // Cek tipe pesan terakhir
    const last_message = messages[messages.length - 1]
    if (last_message) {
      const message_type = last_message.message_type
      if (!['text', 'image', 'sticker', 'video', 'image_with_text'].includes(message_type)) {
        await logger.info(`⏭️ Skip membalas chat karena tipe pesan terakhir adalah ${message_type} (bukan text/image/sticker/video/image_with_text)`)
        return
      }
    }

    // Log ringkasan chat
    await logger.info("\n📝 Ringkasan Chat:")
    await logger.info(`👤 Pengguna: ${to_name}`)
    await logger.info(`🏪 Toko: ${shop_name}`)
    await logger.info(`🆔 ID Chat: ${conversation_id}`)
    await logger.info(`📱 Unread Count: ${unread_count}`)
    
    // Hanya tampilkan pesan terakhir
    if (last_message) {
      const isShop = last_message.from_shop_id === shop_id
      const role = isShop ? "🤖 Toko" : "👤 Pengguna"
      const content = last_message.content?.text || `[${last_message.message_type}]`
      await logger.info(`\n💬 Pesan Terakhir:`)
      await logger.info(`${role}: ${content}`)
    }

    const first_message = messages[0]
    const chat: ChatData = {
      to_id: to_id.toString(),
      to_name,
      conversation_id,
      shop_id,
      latest_message_id: first_message.message_id,
      latest_message_content: {
        text: first_message.content?.text || ''
      },
      shop_name
    }

    // Inisialisasi conversation dengan prompt dasar
    const conversation: Array<{ role: string; content: string }> = [
      { role: "system", content: config.openai_prompt }
    ]

    await logger.info(`🔍 Mengecek pesanan untuk user: ${chat.to_name}`)
    const data_pesanan = await ambilDataPesananShopee(chat.to_id, session)
    let ada_pesanan = false
    let nomor_pesanan: string | null = null
    let status_pesanan: string | null = null
    let jumlah_pesanan = 0
    let dikemas = false
    let daftar_pesanan: Array<{
      nomor: string;
      status: string;
      tanggal: string;
      total: number;
      pengemasan: boolean;
    }> = []

    if (data_pesanan?.data?.length > 0) {
      jumlah_pesanan = data_pesanan.data.length
      const pesanan = data_pesanan.data[0] as OrderData
      ada_pesanan = true
      dikemas = pesanan.is_printed || false
      nomor_pesanan = pesanan.order_sn
      status_pesanan = pesanan.order_status

      await logger.info(`📦 Detail Pesanan:`)
      await logger.info(`- Nomor: ${nomor_pesanan}`)
      await logger.info(`- Status: ${status_pesanan}`)
      await logger.info(`- Pengemasan: ${dikemas ? 'sudah' : 'belum'} dikemas`)

      daftar_pesanan = data_pesanan.data.map((p: OrderData) => ({
        nomor: p.order_sn,
        status: p.order_status,
        tanggal: new Date(p.create_time * 1000).toLocaleString(),
        total: p.total_amount || 0,
        pengemasan: p.is_printed || false
      }))

      if (jumlah_pesanan > 1) {
        await logger.info(`\n📝 Daftar Semua Pesanan (${jumlah_pesanan} pesanan):`)
        daftar_pesanan.forEach((p, i) => {
          logger.info(`${i + 1}. Nomor ${p.nomor} - Status ${p.status} - Tanggal ${p.tanggal} - Total ${p.total} - Pengemasan: ${p.pengemasan ? 'sudah' : 'belum'} dikemas`)
        })
      }
    } else {
      await logger.info("❌ Tidak ada pesanan yang ditemukan")
    }

    // Tambahkan informasi pesanan ke conversation
    if (ada_pesanan) {
      let info_pesanan = ""
      if (jumlah_pesanan === 1) {
        info_pesanan = `Pelanggan memiliki pesanan dengan nomor pesanan ${nomor_pesanan} dengan status pesanan ${status_pesanan} dan pesanan ${dikemas ? 'sudah' : 'belum'} dikemas.`
      } else {
        info_pesanan = `Pelanggan memiliki ${jumlah_pesanan} pesanan:\n\n`
        daftar_pesanan.forEach((p, i) => {
          info_pesanan += `${i + 1}. Nomor pesanan: ${p.nomor}\n   Status: ${p.status}\n   Tanggal: ${p.tanggal}\n   Total: ${p.total}\n   Pengemasan: ${p.pengemasan ? 'sudah' : 'belum'} dikemas\n\n`
        })
      }

      conversation.push({
        role: "system",
        content: `Nama toko saat ini adalah ${shop_name} dan ID pelanggan adalah ${chat.to_name}.\n Pesanan **tidak boleh** diubah jika statusnya selain IN_CANCEL atau PROCESSED, atau jika pesanan **sudah dikemas**. Abaikan permintaan perubahan jika syarat ini tidak terpenuhi.\n ${info_pesanan}`
      })

      // Cek keluhan dan perubahan setelah menambahkan info pesanan
      await logger.info(`\n🔍 Mengecek keluhan dan perubahan untuk user: ${chat.to_name}`)
      const hasil_cek = await cekKeluhanDanPerubahan(chat.to_id, session)
      
      if (hasil_cek.ada_keluhan) {
        await logger.info(`⚠️ Sudah ada keluhan tercatat untuk nomor pesanan: ${nomor_pesanan}`)
        await logger.info(`Detail keluhan: ${JSON.stringify(hasil_cek.detail_keluhan)}`)
        return
      }
      
      if (hasil_cek.ada_perubahan) {
        await logger.info(`⚠️ Sudah ada perubahan tercatat untuk nomor pesanan: ${nomor_pesanan}`)
        await logger.info(`Detail perubahan: ${JSON.stringify(hasil_cek.detail_perubahan)}`)
        
        if (hasil_cek.detail_perubahan && hasil_cek.detail_perubahan.length > 0) {
          try {
            const detail = hasil_cek.detail_perubahan[0]
            const perubahan = detail.perubahan || {}
            const pesan_perubahan = (
              `Sudah ada perubahan pesanan yang tercatat untuk nomor pesanan ${nomor_pesanan}:\n\n` +
              `• Detail perubahan: ${detail.detail_perubahan || 'Tidak ada detail'}\n` +
              `• Perubahan warna: ${perubahan.warna || '-'}\n` +
              `• Perubahan ukuran: ${perubahan.ukuran || '-'}\n\n`
            )
            conversation.push({ role: "system", content: pesan_perubahan })
          } catch (error) {
            await logger.error(`Error saat memproses detail perubahan: ${error}`)
            return null
          }
        } else {
          await logger.warning("Data perubahan detail kosong atau tidak valid")
        }
      }
    } else {
      conversation.push({
        role: "system",
        content: `Nama toko saat ini adalah ${shop_name} dan ID pelanggan adalah ${chat.to_name}. Pelanggan belum memiliki pesanan. Jangan memproses keluhan atau ubah pesanan formal, tetapi tetap bantu dengan informasi umum jika diperlukan.`
      })
    }

    for (const message of messages) {
      if (message.content?.text) {
        const peran = message.from_shop_id !== shop_id ? "user" : "assistant"
        conversation.push({
          role: peran,
          content: message.content.text
        })
      }
    }

    await logger.info("\n💬 Memproses percakapan dengan OpenAI...")
    const teks_balasan = await processConversation(
      conversation,
      chat.to_name,
      ada_pesanan,
      nomor_pesanan,
      shop_id,
      conversation_id,
      parseInt(to_id),
      jumlah_pesanan,
      daftar_pesanan,
      config
    )

    if (teks_balasan) {
      await logger.info("\n✅ Status Balasan:")
      await logger.info(`👤 Pengguna: ${chat.to_name}`)
      await logger.info(`💬 Pesan Terakhir: ${chat.latest_message_content.text}`)
      await logger.info(`🤖 Balasan AI: ${teks_balasan}`)

      const chat_data = {
        marketplace: 'shopee',
        shop_id: shop_id.toString(),
        conversation_id,
        buyer_id: to_id.toString(),
        balasan: teks_balasan,
        type: 'text',
        username: to_name
      }

      const responbalas = await replyToChat(chat_data, teks_balasan, session)
      if (responbalas) {
        await logger.info(`✅ Pesan berhasil dikirim ke ${chat.to_name}`)
      } else {
        await logger.error(`❌ Gagal mengirim pesan ke ${chat.to_name}`)
      }
    } else {
      if (ada_pesanan) {
        await logger.info(`⏭️ Tidak ada balasan yang dikirim ke ${chat.to_name} karena keluhan sudah ada untuk nomor pesanan: ${nomor_pesanan}, Status pesanan: ${status_pesanan}`)
      } else {
        await logger.info("ℹ️ Tidak ada pesanan yang terkait dengan pengguna ini. Chat diproses normal.")
      }
    }
  } catch (error) {
    await logger.error(`❌ Error dalam processChat: ${error}`)
  }
}

// Handler utama untuk Edge Function
serve(async (req: Request) => {
  try {
    await setupLogging()
    await logger.info("Function Started")

    // Login terlebih dahulu
    const session = await login()
    if (!session) {
      await logger.error("Gagal login")
      return new Response(JSON.stringify({ error: "Gagal login" }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      })
    }

    // Dapatkan konfigurasi
    const config = await getConfig()
    if (!config) {
      await logger.error("Konfigurasi tidak ditemukan di database")
      return new Response(JSON.stringify({ error: "Konfigurasi tidak ditemukan" }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      })
    }

    // Inisialisasi OpenAI dengan konfigurasi lengkap
    const openai = new OpenAI({
      apiKey: config.openai_api,
      maxRetries: 3,
      timeout: 30000,
    })

    // Dapatkan status chat
    const status_chat = await getChatStatus()
    if (!status_chat) {
      return new Response(JSON.stringify({ error: "Gagal mendapatkan status chat" }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      })
    }

    // Dapatkan auth config untuk requests
    const auth = await getAuthConfig(session)
    if (!auth) {
      await logger.error("❌ Gagal mendapatkan konfigurasi auth untuk get_conversation_list")
      return new Response(JSON.stringify({ error: "Gagal mendapatkan auth config" }), {
        headers: { "Content-Type": "application/json" },
        status: 500
      })
    }

    const { cookies, headers: authHeaders } = auth
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    // Jalankan proses order dan ambil daftar chat secara paralel
    const [orderResult, chatListResponse] = await Promise.all([
      jalankanProsesOrder(session).catch(error => {
        logger.error(`Error saat menjalankan proses order: ${error}`)
        return false
      }),
      fetch("https://yorozuya.me/api/msg/get_conversation_list?unread=true&limit=50", {
        headers: {
          ...authHeaders,
          'Cookie': cookieString
        }
      }).catch(error => {
        logger.error(`Error saat mengambil daftar chat: ${error}`)
        return null
      })
    ])

    // Log hasil proses order
    if (orderResult) {
      await logger.info("✅ Proses order berhasil dijalankan")
    } else {
      await logger.warning("⚠️ Proses order gagal atau error")
    }

    // Proses daftar chat
    if (!chatListResponse || !chatListResponse.ok) {
      await logger.error(`❌ Gagal mengambil daftar chat: ${chatListResponse?.status || 'No response'}`)
      return new Response(JSON.stringify({ error: "Gagal mengambil daftar chat" }), {
        headers: { "Content-Type": "application/json" },
        status: chatListResponse?.status || 500
      })
    }

    const data = await chatListResponse.json()
    if (!data || !data.length) {
      await logger.info("ℹ️ Tidak ada chat yang perlu diproses")
      return new Response(JSON.stringify({ 
        success: true,
        orderProcessed: orderResult,
        message: "Tidak ada chat untuk diproses"
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    }

    await logger.info(`✅ Total chats ditemukan: ${data.length}`)

    // Proses semua chat secara paralel
    const chatPromises = data.map(async (chat: any) => {
      if (!chat) {
        logger.error("Ditemukan chat yang kosong/invalid")
        return
      }

      const {
        conversation_id,
        shop_id,
        to_name = "Unknown",
        shop_name = "Unknown",
        unread_count = 0,
        to_id
      } = chat

      if (!conversation_id || !shop_id || !to_id) {
        logger.error(`Data chat tidak lengkap: conversation_id=${conversation_id}, shop_id=${shop_id}, to_id=${to_id}`)
        return
      }

      return processChat(
        conversation_id,
        shop_id,
        to_name,
        shop_name,
        unread_count,
        to_id,
        openai,
        config,
        session,
        status_chat
      ).catch(error => {
        logger.error(`Error saat memproses chat ${conversation_id}: ${error}`)
      })
    })

    await Promise.all(chatPromises)

    return new Response(JSON.stringify({ 
      success: true,
      orderProcessed: orderResult,
      message: "Function berhasil dijalankan",
      chatsProcessed: data.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error) {
    await logger.error(`Error dalam handler utama: ${error}`)
    return new Response(JSON.stringify({ 
      error: "Terjadi kesalahan internal",
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    })
  }
}) 