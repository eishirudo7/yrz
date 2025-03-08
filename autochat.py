import requests
import json
import threading
import time
from datetime import datetime
from supabase import create_client, Client
import logging
from logging.handlers import RotatingFileHandler
import os



supabase: Client = create_client("https://jsitzrpjtdorcdxencxm.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzaXR6cnBqdGRvcmNkeGVuY3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjQ5MjEyOSwiZXhwIjoyMDQyMDY4MTI5fQ.tk5zgD7dv-LKae93N2c6Dj3cFSHtEhJYL772QeT7CIQ")

config_chat = supabase.table('settings').select('*').execute()
status_chat = supabase.table('auto_ship_chat').select('shop_id, status_chat').execute()
data = config_chat.data[0] if config_chat.data else None
if data:
    openai_api = data.get('openai_api')
    request_model = data.get('openai_model')
    temperature = data.get('openai_temperature')
    system_data = data.get('openai_prompt')
else:
    logging.warning("Data konfigurasi chatbot tidak ditemukan.")
   
    

def chatbot(conversation, user_id, ada_invoice, nomor_invoice, store_id, conversation_id, user_id_int):

    if ada_invoice:
        
        hasil_cek = cek_keluhan_dan_perubahan(user_id_int, user_id)
        

        if hasil_cek['ada_keluhan']:
            return None
        elif hasil_cek['ada_perubahan']:
          
            detail_perubahan = hasil_cek.get('detail_perubahan', [])
            
            if detail_perubahan and len(detail_perubahan) > 0:
                try:
                    detail = detail_perubahan[0]
                    perubahan = detail.get('perubahan', {})
                    pesan_perubahan = (
                        f"Sudah ada perubahan pesanan yang tercatat untuk invoice {nomor_invoice}:\n\n"
                        f"• Detail perubahan: {detail.get('detail_perubahan', 'Tidak ada detail')}\n"
                        f"• Perubahan warna: {perubahan.get('warna', '-')}\n"
                        f"• Perubahan ukuran: {perubahan.get('ukuran', '-')}\n\n"
                        
                    )
                    conversation.append({"role": "system", "content": pesan_perubahan})
                except Exception as e:
                    logging.error(f"Error saat memproses detail perubahan: {str(e)}")
                    return None
            else:
                logging.warning("Data perubahan detail kosong atau tidak valid")

    tools = [
        {
            "type": "function",
            "function": {
                "name": "tangani_keluhan",
                "description": "Menangani keluhan pelanggan terkait pesanan pelanggan dan menyimpannya di database",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id_pengguna": {
                            "type": "string",
                            "description": "ID pengguna pelanggan yang mengajukan keluhan"
                        },
                        "nama_toko": {
                            "type": "string",
                            "description": "Nama toko yang dikeluhkan"
                        },
                        "status_pesanan": {
                            "type": "string",
                            "description": "Status pesanan saat ini"
                        },
                        "jenis_keluhan": {
                            "type": "string",
                            "enum": [
                                "Produk Tidak Lengkap",
                                "Produk Rusak",
                                

                            ],
                            "description": "Jenis atau kategori keluhan"
                        },
                        "deskripsi_keluhan": {
                            "type": "string",
                            "description": "Deskripsi detail keluhan dari pelanggan"
                        },
                        "nomor_invoice": {
                            "type": "string",
                            "description": "Nomor invoice terkait keluhan"
                        }
                    },
                    "required": ["id_pengguna", "nama_toko", "jenis_keluhan", "deskripsi_keluhan", "nomor_invoice, status_pesanan"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "ubah_detail_pesanan",
                "description": "Mencatat permintaan perubahan detail pesanan seperti warna atau ukuran",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id_pengguna": {
                            "type": "string",
                            "description": "ID pengguna pelanggan yang mengajukan perubahan"
                        },
                        "nama_toko": {
                            "type": "string",
                            "description": "Nama toko yang dikeluhkan"
                        },
                        "nomor_invoice": {
                            "type": "string",
                            "description": "Nomor invoice atau nomor pesanan terkait perubahan"
                        },
                        "status_pesanan": {
                            "type": "string",
                            "description": "Status pesanan saat ini"
                        },
                        'detail_perubahan':{
                            "type": "string",
                            "description": "Rangkuman perubahan yang diminta"
                        },
                        "perubahan": {
                            "type": "object",
                            "properties": {
                                "warna": {
                                    "type": "string",
                                    "description": "Warna baru yang diminta jika ada perubahan"
                                },
                                "ukuran": {
                                    "type": "string",
                                    "description": "Ukuran baru yang diminta jika ada perubahan"
                                }
                            },
                            "description": "Detail perubahan yang diminta"
                        }
                    },
                    "required": ["id_pengguna", "nama_toko", "detail_perubahan", "nomor_invoice", "perubahan", "status_pesanan"]
                }
            }
        }
    ]

    data = {
        "model": request_model,
        "messages": conversation,
        "temperature": temperature,
        "tools": tools,
        "tool_choice": "auto"
    }
    max_retries = 3

    for _ in range(max_retries):
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {openai_api}"},
            json=data
        )
        print(response.json())

        if response.status_code == 200:
            response_data = response.json()["choices"][0]['message']

            if 'tool_calls' in response_data and ada_invoice:
                for tool_call in response_data['tool_calls']:
                    if tool_call['function']['name'] == 'tangani_keluhan':
                        args = json.loads(tool_call['function']['arguments'])
                        tangani_keluhan(args['id_pengguna'], args['nama_toko'], args['jenis_keluhan'], args['deskripsi_keluhan'], args['nomor_invoice'], args['status_pesanan'], store_id, conversation_id, user_id_int)
                        return f"Terima kasih telah memberi tahu kami tentang {args['jenis_keluhan']}. Kami telah mencatat keluhan Anda terkait pesanan dengan nomor invoice {nomor_invoice} dan akan menanganinya sesegera mungkin."
                    elif tool_call['function']['name'] == 'ubah_detail_pesanan':
                        args = json.loads(tool_call['function']['arguments'])
                        try:
                            ubah_detail_pesanan(args['id_pengguna'], args['nama_toko'], args['nomor_invoice'], args['detail_perubahan'], args['perubahan'], args['status_pesanan'], store_id, conversation_id, user_id_int)
                            return f"Terima kasih telah memberi tahu kami tentang perubahan yang Anda inginkan untuk pesanan dengan nomor invoice {args['nomor_invoice']}. Kami telah mencatat perubahan tersebut dan akan menanganinya sesegera mungkin."
                        except Exception as e:
                            logging.error(f"Terjadi kesalahan saat memasukkan data perubahan pesanan: {e}")

            return response_data['content']
        elif response.status_code == 429:
            logging.warning("OpenAI API rate limit exceeded. Skipping...")

            return None
        else:
            logging.error(f"Error while calling OpenAI API: {response.status_code}, {response.text}")
            logging.info("Retrying...")
            time.sleep(5)

    logging.error(f"Failed after {max_retries} attempts")
    return None

def reply_to_chat(chat, reply_text):
    url = "https://yorozuya-v73y.onrender.com/api/msg/send_message"
    
    try:
        # Pastikan data yang diperlukan ada
        if not isinstance(chat, dict):
            return None
            
        to_id = chat.get('buyer_id')
        shop_id = chat.get('shop_id')
        username = chat.get('username', 'Unknown')
        
        if not to_id or not shop_id:
            return None
            
        payload = {
            "toId": int(to_id),
            "messageType": "text",
            "content": reply_text,
            "shopId": int(shop_id)
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
      
        return response
        
    except Exception as e:
       
        return None

def box_exec(conversation_id, shop_id, to_name, shop_name, unread_count, to_id):
    # Cek status chat untuk shop_id tertentu
    status_result = next((item for item in status_chat.data if item['shop_id'] == shop_id), None)
    if status_result and not status_result['status_chat']:
        logging.info(f"Skip membalas chat untuk shop_id {shop_id} karena status_chat = False")
        return
        
    userchat = f"https://yorozuya-v73y.onrender.com/api/msg/get_message?conversationId={conversation_id}&shopId={shop_id}&pageSize=25"
    
    try:
        rawconv = requests.get(userchat)
        conv_data = rawconv.json()
        
        # Periksa struktur response
        if 'response' not in conv_data or 'messages' not in conv_data['response']:
            logging.error("Struktur response tidak sesuai")
           
            return
            
        messages = conv_data['response']['messages']
        if not messages:
            logging.error("Tidak ada pesan dalam response")
            return
            
        messages.reverse()
        
        # Tambahkan pengecekan pesan terakhir untuk menghindari duplikasi
        last_message = messages[-1] if messages else None
        if last_message:
            message_type = last_message.get('message_type')
            if message_type not in ['text', 'image', 'sticker', 'video', "image_with_text"]:
                logging.info(f"Pesan terakhir  bukan text/image/sticker/video/image_with_text (type: {message_type}), skip balasan")
                return
            
        
        # Ambil pesan pertama untuk mendapatkan informasi
        first_message = messages[0]
        
        chat = {
            'to_id': str(to_id),
            'to_name': to_name,
            'conversation_id': conversation_id,
            'shop_id': shop_id,
            'latest_message_id': first_message.get('message_id'),
            'latest_message_content': {
                'text': first_message.get('content', {}).get('text', '')
            },
            'shop_name': shop_name
        }
        
        

        # Lanjutkan dengan logika yang ada
        percakapan = [
            {"role": "system", "content": system_data}
        ]
       
        data_pesanan = ambil_data_pesanan_shopee(chat['to_id'])
        

        ada_invoice = False
        nomor_invoice = None
        status_pesanan = None
        store_id = chat.get('shop_id')
        conversation_id = chat.get('conversation_id')
        store_name = chat.get('shop_name')
        user_id = chat.get('to_id')

        if data_pesanan and 'data' in data_pesanan and len(data_pesanan['data']) > 0:
            pesanan = data_pesanan['data'][0]  # Mengambil pesanan terbaru
            ada_invoice = True
            nomor_invoice = pesanan.get('order_sn')  # Menggunakan order_sn sebagai nomor invoice
            status_pesanan = pesanan.get('order_status')  # Menggunakan order_status

        if ada_invoice:
            percakapan.append({
                "role": "system",
                "content": f"Nama toko saat ini adalah {store_name} dan ID pelanggan adalah {chat['to_name']}. "
                          f"Pelanggan memiliki pesanan dengan nomor invoice {nomor_invoice} dengan status pesanan {status_pesanan}."
            })
        else:
            percakapan.append({
                "role": "system",
                "content": f"Nama toko saat ini adalah {store_name} dan ID pelanggan adalah {chat['to_name']}. "
                          f"Pelanggan belum memiliki pesanan. Jangan memproses keluhan atau ubah pesanan formal, tetapi tetap bantu dengan informasi umum jika diperlukan."
            })

        # Memproses pesan-pesan dari respons API baru
        for message in messages:
            if message.get('content', {}).get('text'):
                peran = "user" if message['from_shop_id'] != store_id else "assistant"
                percakapan.append({
                    "role": peran, 
                    "content": message['content']['text']
                })
        
        teks_balasan = chatbot(percakapan, chat['to_name'], ada_invoice, nomor_invoice, store_id, conversation_id, int(user_id))
        logging.info("==========================================Balasan AI==========================================")
        logging.info(f"Invoice: {nomor_invoice} - Status pesanan: {status_pesanan}")
       
        if teks_balasan is not None:
            
            logging.info(f"👤 {chat['to_name']}: {chat['latest_message_content']['text']}")
            logging.info(f"🤖 AI: {teks_balasan}")
            
            chat_data = {
                'marketplace': 'shopee',
                'shop_id': str(shop_id),
                'conversation_id': conversation_id,
                'buyer_id': str(to_id),
                'balasan': teks_balasan,
                'type': 'text',
                'username': to_name
            }
            
            responbalas = reply_to_chat(chat_data, teks_balasan)
            if responbalas:
                logging.info(f"✅ Pesan berhasil dikirim ke {chat['to_name']}")
            else:
                logging.error(f"❌ Gagal mengirim pesan ke {chat['to_name']}")
        else:
            if ada_invoice:
                logging.info(f"Tidak ada balasan yang dikirim {chat['to_name']} karena keluhan sudah ada untuk invoice: {nomor_invoice}, Status pesanan: {status_pesanan}")
                return  # Menghentikan proses
            else:
                logging.info("Tidak ada invoice yang terkait dengan pengguna ini. Chat diproses normal.")

    except requests.exceptions.RequestException as e:
        logging.error(f"Error saat mengambil data dari API: {str(e)}")
        logging.error(f"Raw response: {rawconv.text if 'rawconv' in locals() else 'No response'}")
        return
    except (json.JSONDecodeError, KeyError) as e:
        logging.error(f"Error saat memproses data JSON: {str(e)}")
        logging.error(f"Raw response: {rawconv.text if 'rawconv' in locals() else 'No response'}")
        return
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
        logging.error(f"Raw response: {rawconv.text if 'rawconv' in locals() else 'No response'}")
        return

def send_replies():
    try:
        datachat = requests.get("https://yorozuya-v73y.onrender.com/api/msg/get_conversation_list?unread=true&limit=20")
        
        if not datachat.ok:
            logging.error(f"Gagal mengambil data chat: Status code {datachat.status_code}")
            return
            
        data = datachat.json()
        if not data:
            logging.info("Tidak ada chat yang perlu diproses")
            return
            
        logging.info(f"Total chats ditemukan: {len(data)}")
        
        threads = []
        for chat in data:
            if not chat:
                logging.error("Ditemukan chat yang kosong/invalid")
                continue
                
            try:
                conversation_id = chat.get("conversation_id")
                shop_id = chat.get("shop_id")
                to_name = chat.get("to_name", "Unknown")
                shop_name = chat.get("shop_name", "Unknown")
                unread_count = chat.get("unread_count", 0)
                to_id = chat.get("to_id")
                
                if not all([conversation_id, shop_id, to_id]):
                    logging.error(f"Data chat tidak lengkap: conversation_id={conversation_id}, shop_id={shop_id}, to_id={to_id}")
                    continue

                thread = threading.Thread(target=box_exec, args=(
                    conversation_id,
                    shop_id,
                    to_name,
                    shop_name,
                    unread_count,
                    to_id
                ))
                thread.start()
                threads.append(thread)
                
            except Exception as e:
                logging.error(f"Error processing chat: {str(e)}")
                continue

        for thread in threads:
            thread.join()

    except requests.exceptions.RequestException as e:
        logging.error(f"Error saat mengambil data dari API: {str(e)}")
    except json.JSONDecodeError as e:
        logging.error(f"Error saat parsing JSON response: {str(e)}")
    except Exception as e:
        logging.error(f"Error tidak terduga dalam send_replies: {str(e)}")

def tangani_keluhan(id_pengguna: str, nama_toko: str, jenis_keluhan: str, deskripsi_keluhan: str, nomor_invoice: str, status_pesanan: str, store_id: str, msg_id: str, user_id: int):
    try:
        # Memasukkan data keluhan ke Supabase
        result = supabase.table('keluhan').upsert({
            "id_pengguna": id_pengguna,
            "nama_toko": nama_toko,
            "jenis_keluhan": jenis_keluhan,
            "deskripsi_keluhan": deskripsi_keluhan,
            "nomor_invoice": nomor_invoice,
            "status_pesanan": status_pesanan,
            "store_id": store_id,
            "msg_id": msg_id,
            "user_id": user_id
        }, on_conflict=['nomor_invoice']).execute()

        logging.info(f"Data keluhan berhasil dimasukkan: {result.data}")
        return True
    except Exception as e:
        logging.error(f"Terjadi kesalahan saat memasukkan data keluhan: {e}")
        return False


def cek_keluhan_dan_perubahan(user_id: int, id_pengguna: str):
    try:
        url = f"https://yorozuya-v73y.onrender.com/api/cek_perubahan?user_id={user_id}"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "ada_keluhan": data.get("ada_keluhan", False),
                "ada_perubahan": data.get("ada_perubahan", False),
                "detail_keluhan": data.get("keluhan_detail", []),
                "detail_perubahan": data.get("perubahan_detail", []),
                "jumlah_keluhan": data.get("jumlah_keluhan", 0),
                "jumlah_perubahan": data.get("jumlah_perubahan", 0)
            }
        else:
            logging.error(f"Gagal mengecek keluhan/perubahan: {response.status_code}")
            return {
                "ada_keluhan": False,
                "ada_perubahan": False,
                "detail_keluhan": [],
                "detail_perubahan": [],
                "jumlah_keluhan": 0,
                "jumlah_perubahan": 0
            }
            
    except Exception as e:
        logging.error(f"Error saat cek keluhan dan perubahan: {str(e)}")
        return {
            "ada_keluhan": False,
            "ada_perubahan": False,
            "detail_keluhan": [],
            "detail_perubahan": []
        }

def ubah_detail_pesanan(id_pengguna: str, nama_toko: str, nomor_invoice: str, detail_perubahan: str, perubahan: dict, status_pesanan: str,store_id:str, msg_id:str, user_id:int):
    try:
        # Memasukkan data perubahan pesanan ke Supabase
        result = supabase.table('perubahan_pesanan').upsert({
            "id_pengguna": id_pengguna,
            "nama_toko": nama_toko,
            "nomor_invoice": nomor_invoice,
            "detail_perubahan": detail_perubahan,
            "perubahan": perubahan,
            "status_pesanan": status_pesanan,
            "store_id": store_id,
            "msg_id": msg_id,
            "user_id": user_id
        }, on_conflict=['nomor_invoice']).execute()
        logging.info(f"Data perubahan pesanan berhasil dimasukkan: {result.data}")
        return True
    except Exception as e:
        logging.error(f"Terjadi kesalahan saat memasukkan data perubahan pesanan: {e}")
        return False

def ambil_data_pesanan_shopee(user_id: str) -> dict:
    url = f"https://yorozuya-v73y.onrender.com/api/order_details?user_id={user_id}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            if len(data.get('data', [])) > 0:
                return data
        return None
    except requests.exceptions.ConnectionError as e:
        return None
    except Exception as e:
        return None

def jalankan_proses_order() -> bool:
    url = "https://yorozuya-v73y.onrender.com/api/proses_order"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            logging.info("✅ Berhasil menjalankan proses order di server")
            return True
        else:
            logging.error(f"❌ Gagal menjalankan proses order. Status code: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError as e:
        logging.error(f"❌ Terjadi kesalahan koneksi saat menjalankan proses order: {str(e)}")
        return False
    except Exception as e:
        logging.error(f"❌ Terjadi kesalahan tidak terduga saat menjalankan proses order: {str(e)}")
        return False

def setup_logging():
    log_directory = 'logs'
    if not os.path.exists(log_directory):
        os.makedirs(log_directory)

    log_file = os.path.join(log_directory, 'chatbot.log')

    # Konfigurasi format logging
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    # File handler untuk menyimpan log ke file
    file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
    file_handler.setFormatter(formatter)

    # Stream handler untuk menampilkan log di terminal
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    # Konfigurasi logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Menghapus handler yang sudah ada
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)

    # Mematikan log dari httpx
    logging.getLogger("httpx").setLevel(logging.WARNING)



def main():
    setup_logging()
    logging.info("==========================================Program dimulai==========================================")
    jalankan_proses_order()
    send_replies()
    logging.info("==========================================Program selesai==========================================")

if __name__ == "__main__":
    print("Mulai menjalankan program...")
    main()
