import requests

url = "http://localhost:10000/api/webhook"

payload = {"type":"message","region":"ID","content":{"message_id":"23089311223338998130","shop_id":1030103309,"request_id":"af9fd25e-c71f-4abb-bf30-f624691c69a4","from_id":1030311698,"from_user_name":"0hoh5xk9ny","to_id":18149569,"to_user_name":"yorozuya.official","message_type":"text","content":{"text":"Oke kak"},"conversation_id":"77951806321807122","created_timestamp":1728992625,"region":"ID","is_in_chatbot_session":False,"source_content":{},"quoted_msg":{"message_id":""},"sub_account_id":0,"sub_account_name":""},"shop_id":18148233,"code":10,"timestamp":1728992626}

response = requests.post(url, json=payload)

if response.status_code == 200:
    print("Pesan berhasil dikirim")
    print("Respon:", response.json())
else:
    print("Gagal mengirim pesan")

    print("Status code:", response.status_code)
    print("Respon:", response.text)