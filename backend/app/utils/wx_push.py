import os

from wxpusher import WxPusher
from dotenv import load_dotenv

load_dotenv()

def send_md_message(message):

    WxPusher.send_message(message,
                          content_type=3,
                          uids=[os.getenv("WX_PUSH_UID")],
                          token=os.getenv("WX_PUSH_TOKEN"))