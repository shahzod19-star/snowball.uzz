# server.py - Qor Jangi (Snow Clash Online) Kengaytirilgan Real-time Multiplayer Server
import os
import sys
import json
import asyncio
import random
import string
from aiohttp import web

# UTF-8 konsol chiqishi (Windows cp1251 xatolarini oldini olish uchun)
try:
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# Xonalar ombori
rooms = {}

class Room:
    def __init__(self, room_id, name, mode='1v1', map_name='wonderland', max_players=2, is_custom=False):
        self.room_id = room_id
        self.name = name
        self.mode = mode
        self.map_name = map_name
        self.max_players = max_players
        self.is_custom = is_custom
        self.clients = {}  # ws -> player_dict
        self.host_ws = None
        self.is_playing = False
        self.match_time = 180

    def get_public_info(self):
        return {
            'roomId': self.room_id,
            'name': self.name,
            'mode': self.mode,
            'map': self.map_name,
            'playerCount': len(self.clients),
            'maxPlayers': self.max_players,
            'isPlaying': self.is_playing,
            'isCustom': self.is_custom
        }

    def add_player(self, ws, player_data):
        if self.host_ws is None:
            self.host_ws = ws
            player_data['isHost'] = True
        else:
            player_data['isHost'] = False

        # Jamoani belgilash
        if self.mode in ['2v2', '4v4']:
            blue_count = sum(1 for p in self.clients.values() if p.get('team') == 'blue')
            red_count = sum(1 for p in self.clients.values() if p.get('team') == 'red')
            player_data['team'] = 'blue' if blue_count <= red_count else 'red'
        elif self.mode == '1v1':
            player_data['team'] = 'blue' if len(self.clients) == 0 else 'red'
        else:
            player_data['team'] = f'ffa_{len(self.clients)}'

        player_data['isReady'] = player_data.get('isHost', False) # Xona egasi avtomatik tayyor
        self.clients[ws] = player_data

    def remove_player(self, ws):
        if ws in self.clients:
            was_host = self.clients[ws].get('isHost', False)
            del self.clients[ws]

            # Agar host chiqsa, keyingi o'yinchiga hostlik beriladi
            if was_host and len(self.clients) > 0:
                next_ws = next(iter(self.clients.keys()))
                self.host_ws = next_ws
                self.clients[next_ws]['isHost'] = True
                self.clients[next_ws]['isReady'] = True

    async def broadcast(self, message, exclude=None):
        msg_str = json.dumps(message)
        dead_sockets = []
        for ws in list(self.clients.keys()):
            if ws != exclude and not ws.closed:
                try:
                    await ws.send_str(msg_str)
                except Exception:
                    dead_sockets.append(ws)
            elif ws.closed:
                dead_sockets.append(ws)

        for ws in dead_sockets:
            self.remove_player(ws)

def generate_room_code():
    chars = string.ascii_uppercase + "23456789"
    return "QOR-" + "".join(random.choice(chars) for _ in range(4))

def get_max_players_for_mode(mode):
    if mode == '1v1': return 2
    if mode == '2v2': return 4
    if mode == '4v4': return 8
    return 6  # ffa

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    current_room = None
    player_id = f"p_{id(ws)}_{random.randint(100, 999)}"

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                data = json.loads(msg.data)
                mtype = data.get('type')

                # 1. YANGI XONA YARATISH
                if mtype == 'create_room':
                    mode = data.get('mode', '1v1')
                    custom_code = (data.get('roomCode') or '').strip().upper()
                    room_id = custom_code if custom_code else generate_room_code()
                    map_name = data.get('map', 'wonderland')
                    room_name = data.get('roomName') or f"{data.get('playerName', 'O\'yinchi')} xonasi"
                    max_p = get_max_players_for_mode(mode)

                    room = Room(room_id, room_name, mode, map_name, max_p, is_custom=True)
                    rooms[room_id] = room
                    current_room = room

                    player_data = {
                        'id': player_id,
                        'name': data.get('playerName', 'QorJangchisi'),
                        'color': data.get('color', '#e63946'),
                        'characterType': data.get('characterType', 'human'),
                        'x': 250,
                        'y': 300,
                        'angle': 0,
                        'hp': 100,
                        'snowballs': 3,
                        'isCrafting': False,
                        'isDead': False
                    }
                    room.add_player(ws, player_data)

                    await ws.send_str(json.dumps({
                        'type': 'room_created',
                        'room': room.get_public_info(),
                        'players': list(room.clients.values()),
                        'yourId': player_id
                    }))

                # 2. MAVJUD XONAGA QO'SHILISH
                elif mtype == 'join_room':
                    target_id = (data.get('roomId') or '').strip().upper()
                    if target_id not in rooms:
                        await ws.send_str(json.dumps({
                            'type': 'error',
                            'message': f"'{target_id}' nomli xona topilmadi!"
                        }))
                        continue

                    room = rooms[target_id]
                    if len(room.clients) >= room.max_players:
                        await ws.send_str(json.dumps({
                            'type': 'error',
                            'message': "Bu xona to'lgan!"
                        }))
                        continue

                    current_room = room
                    player_data = {
                        'id': player_id,
                        'name': data.get('playerName', 'QorJangchisi'),
                        'color': data.get('color', '#4cc9f0'),
                        'characterType': data.get('characterType', 'human'),
                        'x': 450,
                        'y': 300,
                        'angle': 0,
                        'hp': 100,
                        'snowballs': 3,
                        'isCrafting': False,
                        'isDead': False
                    }
                    room.add_player(ws, player_data)

                    await ws.send_str(json.dumps({
                        'type': 'room_joined',
                        'room': room.get_public_info(),
                        'players': list(room.clients.values()),
                        'yourId': player_id
                    }))

                    # Xonadagilarga yangi o'yinchi haqida xabar
                    await room.broadcast({
                        'type': 'player_joined_lobby',
                        'room': room.get_public_info(),
                        'players': list(room.clients.values()),
                        'newPlayer': player_data
                    }, exclude=ws)

                # 3. TAYYORMAN / TAYYOR EMASMAN (Ready toggle)
                elif mtype == 'toggle_ready' and current_room and ws in current_room.clients:
                    player = current_room.clients[ws]
                    player['isReady'] = not player.get('isReady', False)
                    await current_room.broadcast({
                        'type': 'lobby_players_update',
                        'players': list(current_room.clients.values())
                    })

                # 4. JAMOA ALMASHTIRISH (Ko'k <-> Qizil)
                elif mtype == 'switch_team' and current_room and ws in current_room.clients:
                    player = current_room.clients[ws]
                    if current_room.mode in ['2v2', '4v4']:
                        player['team'] = 'red' if player.get('team') == 'blue' else 'blue'
                        await current_room.broadcast({
                            'type': 'lobby_players_update',
                            'players': list(current_room.clients.values())
                        })

                # 5. O'YINNI BOSHLASH (Faqat host boshlay oladi)
                elif mtype == 'start_match' and current_room and ws in current_room.clients:
                    if current_room.clients[ws].get('isHost', False):
                        current_room.is_playing = True
                        await current_room.broadcast({
                            'type': 'match_started',
                            'room': current_room.get_public_info(),
                            'players': list(current_room.clients.values())
                        })

                # 6. O'YINCHI HARAKATI SINXRONIZATSIYASI
                elif mtype == 'update_position' and current_room and ws in current_room.clients:
                    player = current_room.clients[ws]
                    player['x'] = data.get('x', player['x'])
                    player['y'] = data.get('y', player['y'])
                    player['angle'] = data.get('angle', player['angle'])
                    player['hp'] = data.get('hp', player['hp'])
                    player['snowballs'] = data.get('snowballs', player['snowballs'])
                    player['isCrafting'] = data.get('isCrafting', False)
                    player['isMoving'] = data.get('isMoving', False)
                    player['isDead'] = data.get('isDead', False)

                    await current_room.broadcast({
                        'type': 'state_sync',
                        'players': list(current_room.clients.values())
                    }, exclude=ws)

                # 7. QOR OTISH
                elif mtype == 'throw_snowball' and current_room:
                    await current_room.broadcast({
                        'type': 'remote_throw',
                        'snowball': data.get('snowball')
                    }, exclude=ws)

                # 8. QOR TEKISHI
                elif mtype == 'hit_event' and current_room:
                    await current_room.broadcast({
                        'type': 'remote_hit',
                        'targetId': data.get('targetId'),
                        'shooterName': data.get('shooterName'),
                        'damage': data.get('damage', 25),
                        'x': data.get('x'),
                        'y': data.get('y')
                    })

                # 9. O'YINCHI MAG'LUB BO'LGANI
                elif mtype == 'player_eliminated' and current_room:
                    await current_room.broadcast({
                        'type': 'remote_eliminated',
                        'victimId': data.get('victimId'),
                        'victimName': data.get('victimName'),
                        'killerName': data.get('killerName'),
                        'killerTeam': data.get('killerTeam')
                    })

                # 10. LOBBIDAN CHIQISH
                elif mtype == 'leave_room' and current_room:
                    current_room.remove_player(ws)
                    await current_room.broadcast({
                        'type': 'player_left_lobby',
                        'room': current_room.get_public_info(),
                        'players': list(current_room.clients.values()),
                        'leftPlayerId': player_id
                    })
                    if len(current_room.clients) == 0 and current_room.room_id in rooms:
                        del rooms[current_room.room_id]
                    current_room = None

            elif msg.type == web.WSMsgType.ERROR:
                pass

    finally:
        if current_room:
            current_room.remove_player(ws)
            await current_room.broadcast({
                'type': 'player_left_lobby',
                'room': current_room.get_public_info(),
                'players': list(current_room.clients.values()),
                'leftPlayerId': player_id
            })
            if len(current_room.clients) == 0 and current_room.room_id in rooms:
                del rooms[current_room.room_id]

    return ws

# REST API: Faol ochiq xonalar ro'yxati
async def api_rooms(request):
    rooms_data = [r.get_public_info() for r in rooms.values()]
    return web.json_response({'rooms': rooms_data})

# REST API: Server holati
async def api_status(request):
    total_clients = sum(len(r.clients) for r in rooms.values())
    return web.json_response({
        'status': 'online',
        'active_rooms': len(rooms),
        'total_players': total_clients
    })

def make_app():
    app = web.Application()
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/api/rooms', api_rooms)
    app.router.add_get('/api/status', api_status)

    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    if not os.path.exists(static_dir):
        static_dir = os.path.dirname(__file__)
    app.router.add_get('/', lambda req: web.FileResponse(os.path.join(static_dir, 'index.html')))
    app.router.add_static('/', static_dir)
    return app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"[*] Qor Jangi (Snow Clash) Serveri ishga tushdi: http://localhost:{port}")
    web.run_app(make_app(), host='0.0.0.0', port=port)
