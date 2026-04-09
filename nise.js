import pygame
import random
import math
import time

# --- 初期化 ---
pygame.init()

# --- 画面の初期設定 ---
info = pygame.display.Info()
SCREEN_WIDTH = info.current_w
SCREEN_HEIGHT = info.current_h
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.FULLSCREEN | pygame.RESIZABLE)
pygame.display.set_caption("迷路ダッシュ：プロフェッショナル・エディション")

# --- 仮想画面設定 (比率固定用) ---
VIRTUAL_WIDTH = 1280
VIRTUAL_HEIGHT = 720
virtual_surface = pygame.Surface((VIRTUAL_WIDTH, VIRTUAL_HEIGHT))

# --- 定数 ---
GRID_SIZE = 60
GRID_WORLD_WIDTH = 50
GRID_WORLD_HEIGHT = 50
MAX_STAGE = 98

# --- 💡 スケール管理 ---
SCALE_FACTOR = 1.0
MAX_SCALE_FACTOR = 2.0
MIN_SCALE_FACTOR = 0.5
SCALE_STEP = 0.1

def calculate_auto_scale():
    return min(SCREEN_WIDTH / VIRTUAL_WIDTH, SCREEN_HEIGHT / VIRTUAL_HEIGHT)

def get_drawing_scale():
    return calculate_auto_scale() * SCALE_FACTOR

# --- 🎨 カラーパレット ---
BG_COLOR = (30, 30, 35)
WALL_COLOR = (60, 100, 200)
PLAYER_COLOR = (255, 255, 255)
ENEMY_RED_COLOR = (255, 60, 60)
ENEMY_PURPLE_COLOR = (180, 60, 255)
GOAL_COLOR = (100, 255, 100)
YELLOW_BLOCK_COLOR = (255, 215, 0)
TEXT_COLOR = (240, 240, 240)
UI_BUTTON_COLOR = (100, 100, 100, 180)
UI_HOVER_COLOR = (150, 150, 150, 200)

# --- 🔠 フォント ---
FONT_PATH = pygame.font.match_font('meiryo', bold=True) or pygame.font.match_font('msgothic')
font_xl = pygame.font.Font(FONT_PATH, 100)
font_l = pygame.font.Font(FONT_PATH, 70)
font_m = pygame.font.Font(FONT_PATH, 40)
font_s = pygame.font.Font(FONT_PATH, 24)

# --- 🛠️ クラス定義 ---

class ExplosionPiece:
    def __init__(self, x, y, color):
        self.x, self.y = x, y
        self.color = color
        self.size = random.randint(4, 10)
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(2, 6)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.life = 255

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.life -= 8
        return self.life > 0

    def draw(self, surface, ox, oy):
        if self.life <= 0: return
        s = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
        s.fill((*self.color[:3], self.life))
        surface.blit(s, (self.x + ox, self.y + oy))

class Enemy:
    def __init__(self, gx, gy, is_purple):
        self.gx, self.gy = gx, gy
        self.is_purple = is_purple
        self.x = gx * GRID_SIZE
        self.y = gy * GRID_SIZE
        self.target_x, self.target_y = self.x, self.y

    def move(self, pgx, pgy, wall_set):
        if self.is_purple: # 追跡
            dx = 1 if pgx > self.gx else -1 if pgx < self.gx else 0
            dy = 1 if pgy > self.gy else -1 if pgy < self.gy else 0
            if dx != 0 and (self.gx + dx, self.gy) not in wall_set: self.gx += dx
            elif dy != 0 and (self.gx, self.gy + dy) not in wall_set: self.gy += dy
        else: # ランダム
            moves = [(0,1), (0,-1), (1,0), (-1,0)]
            random.shuffle(moves)
            for dx, dy in moves:
                if (self.gx + dx, self.gy + dy) not in wall_set:
                    self.gx += dx
                    self.gy += dy
                    break
        self.target_x, self.target_y = self.gx * GRID_SIZE, self.gy * GRID_SIZE

    def update(self):
        self.x += (self.target_x - self.x) * 0.2
        self.y += (self.target_y - self.y) * 0.2

# --- 🎮 ゲーム変数 ---
current_stage = 1
unlocked_stage = 1
debug_code_input = "" # 333用
game_state = 'HOME'
player_gx, player_gy = 0, 0
player_x, player_y = 0.0, 0.0
walls = set()
enemies = []
yellow_blocks = set()
explosions = []
move_queue = []
last_move_time = 0
last_enemy_move_time = 0
camera_x, camera_y = 0, 0
score = 0
start_time = 0
show_controller = True

# --- 🛠️ 関数 ---

def generate_stage(stage_num):
    global walls, enemies, yellow_blocks, player_gx, player_gy, player_x, player_y
    walls.clear()
    enemies.clear()
    yellow_blocks.clear()
    player_gx, player_gy = 0, 0
    player_x, player_y = 0.0, 0.0
    
    # 壁の生成 (外周)
    half = 5 + (stage_num // 2)
    for i in range(-half, half + 1):
        walls.add((i, -half))
        walls.add((i, half))
        walls.add((-half, i))
        walls.add((half, i))
    
    # 内部のランダムな壁
    for _ in range(stage_num * 2 + 10):
        wx, wy = random.randint(-half+1, half-1), random.randint(-half+1, half-1)
        if (wx, wy) != (0,0): walls.add((wx, wy))
        
    # 黄色ブロック
    for _ in range(3 + stage_num // 3):
        while True:
            yx, yy = random.randint(-half+1, half-1), random.randint(-half+1, half-1)
            if (yx, yy) != (0,0) and (yx, yy) not in walls:
                yellow_blocks.add((yx, yy))
                break
                
    # 敵
    for _ in range(1 + stage_num // 10):
        is_p = random.random() < 0.3
        while True:
            ex, ey = random.randint(-half+1, half-1), random.randint(-half+1, half-1)
            if abs(ex) + abs(ey) > 4 and (ex, ey) not in walls:
                enemies.append(Enemy(ex, ey, is_p))
                break

def start_game(stage_num):
    global game_state, current_stage, score, start_time, move_queue
    current_stage = stage_num
    generate_stage(stage_num)
    score = 0
    start_time = time.time()
    move_queue = []
    game_state = 'PLAYING'

def get_virtual_mouse_pos(physical_pos):
    scale = get_drawing_scale()
    sw, sh = VIRTUAL_WIDTH * scale, VIRTUAL_HEIGHT * scale
    dx, dy = (SCREEN_WIDTH - sw) // 2, (SCREEN_HEIGHT - sh) // 2
    return (physical_pos[0] - dx) / scale, (physical_pos[1] - dy) / scale

# --- ボタン設定 ---
B_SIZE = 100
controller_buttons = [
    {'key': pygame.K_UP, 'rect': pygame.Rect(1100, 450, B_SIZE, B_SIZE), 'label': '▲'},
    {'key': pygame.K_DOWN, 'rect': pygame.Rect(1100, 580, B_SIZE, B_SIZE), 'label': '▼'},
    {'key': pygame.K_LEFT, 'rect': pygame.Rect(1000, 515, B_SIZE, B_SIZE), 'label': '◀'},
    {'key': pygame.K_RIGHT, 'rect': pygame.Rect(1200, 515, B_SIZE, B_SIZE), 'label': '▶'}
]

scale_buttons = [
    {'act': 'plus', 'rect': pygame.Rect(580, 650, 40, 40), 'label': '+'},
    {'act': 'minus', 'rect': pygame.Rect(630, 650, 40, 40), 'label': '-'},
    {'act': 'reset', 'rect': pygame.Rect(680, 650, 40, 40), 'label': 'R'}
]

# --- メインループ ---
clock = pygame.time.Clock()
running = True

while running:
    now = pygame.time.get_ticks()
    mouse_pos = pygame.mouse.get_pos()
    v_mouse = get_virtual_mouse_pos(mouse_pos)
    
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        
        if event.type == pygame.VIDEORESIZE:
            SCREEN_WIDTH, SCREEN_HEIGHT = event.size
            screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.RESIZABLE)

        if event.type == pygame.KEYDOWN:
            # デバッグ入力ロジック
            if game_state == 'HOME':
                debug_code_input += event.unicode
                if "333" in debug_code_input:
                    unlocked_stage = MAX_STAGE
                    debug_code_input = "" # リセット
                elif len(debug_code_input) > 10:
                    debug_code_input = debug_code_input[-3:]

            if event.key == pygame.K_ESCAPE: running = False
            if event.key == pygame.K_F1: show_controller = not show_controller
            
            # スケールキー操作
            if event.key == pygame.K_F2: SCALE_FACTOR = min(MAX_SCALE_FACTOR, SCALE_FACTOR + SCALE_STEP)
            if event.key == pygame.K_F3: SCALE_FACTOR = max(MIN_SCALE_FACTOR, SCALE_FACTOR - SCALE_STEP)
            if event.key == pygame.K_F4: SCALE_FACTOR = 1.0

            if game_state == 'HOME' and event.key == pygame.K_SPACE:
                start_game(current_stage)
            elif game_state in ['CLEAR', 'OVER'] and event.key == pygame.K_SPACE:
                if game_state == 'CLEAR': current_stage = min(MAX_STAGE, current_stage + 1)
                start_game(current_stage)

            # 移動入力 (WASD / 矢印)
            if game_state == 'PLAYING':
                k = event.key
                if k in [pygame.K_w, pygame.K_UP]: move_queue.append(pygame.K_UP)
                if k in [pygame.K_s, pygame.K_DOWN]: move_queue.append(pygame.K_DOWN)
                if k in [pygame.K_a, pygame.K_LEFT]: move_queue.append(pygame.K_LEFT)
                if k in [pygame.K_d, pygame.K_RIGHT]: move_queue.append(pygame.K_RIGHT)

        if event.type == pygame.KEYUP and game_state == 'PLAYING':
            k = event.key
            mapping = {pygame.K_w: pygame.K_UP, pygame.K_UP: pygame.K_UP, 
                       pygame.K_s: pygame.K_DOWN, pygame.K_DOWN: pygame.K_DOWN,
                       pygame.K_a: pygame.K_LEFT, pygame.K_LEFT: pygame.K_LEFT,
                       pygame.K_d: pygame.K_RIGHT, pygame.K_RIGHT: pygame.K_RIGHT}
            if k in mapping and mapping[k] in move_queue: move_queue.remove(mapping[k])

        if event.type == pygame.MOUSEBUTTONDOWN:
            # スケールボタン処理 (globalが必要なためここに記述)
            for sb in scale_buttons:
                if sb['rect'].collidepoint(v_mouse):
                    if sb['act'] == 'plus': SCALE_FACTOR = min(MAX_SCALE_FACTOR, SCALE_FACTOR + SCALE_STEP)
                    if sb['act'] == 'minus': SCALE_FACTOR = max(MIN_SCALE_FACTOR, SCALE_FACTOR - SCALE_STEP)
                    if sb['act'] == 'reset': SCALE_FACTOR = 1.0
            
            if game_state == 'HOME' and v_mouse[1] > 400: # 簡易スタート
                start_game(current_stage)
            
            if game_state == 'PLAYING' and show_controller:
                for cb in controller_buttons:
                    if cb['rect'].collidepoint(v_mouse):
                        move_queue.append(cb['key'])

        if event.type == pygame.MOUSEBUTTONUP:
            if game_state == 'PLAYING':
                # タッチ用キューのクリア (簡易)
                for cb in controller_buttons:
                    if cb['key'] in move_queue: move_queue.remove(cb['key'])

    # --- 更新ロジック ---
    if game_state == 'PLAYING':
        # プレイヤー移動
        if move_queue and now - last_move_time > 100:
            target_move = move_queue[-1]
            dx, dy = 0, 0
            if target_move == pygame.K_UP: dy = -1
            if target_move == pygame.K_DOWN: dy = 1
            if target_move == pygame.K_LEFT: dx = -1
            if target_move == pygame.K_RIGHT: dx = 1
            
            if (player_gx + dx, player_gy + dy) not in walls:
                player_gx += dx
                player_gy += dy
                # 回収判定
                if (player_gx, player_gy) in yellow_blocks:
                    yellow_blocks.remove((player_gx, player_gy))
                    score += 100
                    for _ in range(10): explosions.append(ExplosionPiece(player_gx*GRID_SIZE, player_gy*GRID_SIZE, YELLOW_BLOCK_COLOR))
            last_move_time = now

        player_x += (player_gx * GRID_SIZE - player_x) * 0.3
        player_y += (player_gy * GRID_SIZE - player_y) * 0.3
        
        # 敵移動
        if now - last_enemy_move_time > 400:
            for e in enemies: e.move(player_gx, player_gy, walls)
            last_enemy_move_time = now
        
        for e in enemies:
            e.update()
            # 衝突判定
            if abs(e.x - player_x) < 40 and abs(e.y - player_y) < 40:
                game_state = 'OVER'
        
        # クリア判定 (黄色ブロック全回収)
        if not yellow_blocks:
            game_state = 'CLEAR'
            if current_stage == unlocked_stage: unlocked_stage = min(MAX_STAGE, unlocked_stage + 1)

        # カメラ更新
        camera_x += (player_x - camera_x) * 0.1
        camera_y += (player_y - camera_y) * 0.1

    # エフェクト更新
    explosions = [p for p in explosions if p.update()]

    # --- 描画 ---
    virtual_surface.fill(BG_COLOR)
    ox, oy = VIRTUAL_WIDTH//2 - camera_x, VIRTUAL_HEIGHT//2 - camera_y

    if game_state == 'HOME':
        txt = font_xl.render("MAZE DASH", True, GOAL_COLOR)
        virtual_surface.blit(txt, (VIRTUAL_WIDTH//2 - txt.get_width()//2, 150))
        
        st_txt = font_m.render(f"STAGE {current_stage} / UNLOCKED: {unlocked_stage}", True, TEXT_COLOR)
        virtual_surface.blit(st_txt, (VIRTUAL_WIDTH//2 - st_txt.get_width()//2, 300))
        
        start_txt = font_m.render("PRESS SPACE TO START", True, PLAYER_COLOR)
        virtual_surface.blit(start_txt, (VIRTUAL_WIDTH//2 - start_txt.get_width()//2, 450))
        
        if unlocked_stage == MAX_STAGE:
            dbg_txt = font_s.render("DEBUG MODE: ALL STAGES UNLOCKED (Code: 333)", True, YELLOW_BLOCK_COLOR)
            virtual_surface.blit(dbg_txt, (VIRTUAL_WIDTH//2 - dbg_txt.get_width()//2, 550))

    elif game_state in ['PLAYING', 'CLEAR', 'OVER']:
        # 壁
        for wx, wy in walls:
            pygame.draw.rect(virtual_surface, WALL_COLOR, (wx*GRID_SIZE + ox, wy*GRID_SIZE + oy, GRID_SIZE-2, GRID_SIZE-2))
        # 黄色ブロック
        for yx, yy in yellow_blocks:
            pygame.draw.ellipse(virtual_surface, YELLOW_BLOCK_COLOR, (yx*GRID_SIZE + ox + 15, yy*GRID_SIZE + oy + 15, 30, 30))
        # 敵
        for e in enemies:
            color = ENEMY_PURPLE_COLOR if e.is_purple else ENEMY_RED_COLOR
            pygame.draw.rect(virtual_surface, color, (e.x + ox + 5, e.y + oy + 5, GRID_SIZE-10, GRID_SIZE-10))
        # プレイヤー
        pygame.draw.rect(virtual_surface, PLAYER_COLOR, (player_x + ox + 5, player_y + oy + 5, GRID_SIZE-10, GRID_SIZE-10))
        # エフェクト
        for p in explosions: p.draw(virtual_surface, ox, oy)
        
        # UI
        ui_score = font_m.render(f"SCORE: {score}", True, TEXT_COLOR)
        virtual_surface.blit(ui_score, (20, 20))
        ui_stage = font_m.render(f"STAGE: {current_stage}", True, TEXT_COLOR)
        virtual_surface.blit(ui_stage, (20, 70))

        if game_state == 'CLEAR':
            over_surface = pygame.Surface((VIRTUAL_WIDTH, VIRTUAL_HEIGHT), pygame.SRCALPHA)
            over_surface.fill((0, 0, 0, 150))
            virtual_surface.blit(over_surface, (0,0))
            msg = font_l.render("STAGE CLEAR!", True, GOAL_COLOR)
            virtual_surface.blit(msg, (VIRTUAL_WIDTH//2 - msg.get_width()//2, 250))
            sub = font_m.render("PRESS SPACE FOR NEXT", True, TEXT_COLOR)
            virtual_surface.blit(sub, (VIRTUAL_WIDTH//2 - sub.get_width()//2, 400))

        if game_state == 'OVER':
            over_surface = pygame.Surface((VIRTUAL_WIDTH, VIRTUAL_HEIGHT), pygame.SRCALPHA)
            over_surface.fill((0, 0, 0, 150))
            virtual_surface.blit(over_surface, (0,0))
            msg = font_l.render("GAME OVER", True, ENEMY_RED_COLOR)
            virtual_surface.blit(msg, (VIRTUAL_WIDTH//2 - msg.get_width()//2, 250))
            sub = font_m.render("PRESS SPACE TO RETRY", True, TEXT_COLOR)
            virtual_surface.blit(sub, (VIRTUAL_WIDTH//2 - sub.get_width()//2, 400))

    # コントローラー描画
    if show_controller and game_state == 'PLAYING':
        for cb in controller_buttons:
            c = UI_HOVER_COLOR if cb['rect'].collidepoint(v_mouse) else UI_BUTTON_COLOR
            pygame.draw.rect(virtual_surface, c, cb['rect'], border_radius=10)
            l = font_m.render(cb['label'], True, TEXT_COLOR)
            virtual_surface.blit(l, l.get_rect(center=cb['rect'].center))

    # スケールボタン描画
    for sb in scale_buttons:
        c = UI_HOVER_COLOR if sb['rect'].collidepoint(v_mouse) else UI_BUTTON_COLOR
        pygame.draw.rect(virtual_surface, c, sb['rect'], border_radius=5)
        l = font_s.render(sb['label'], True, TEXT_COLOR)
        virtual_surface.blit(l, l.get_rect(center=sb['rect'].center))
    
    scale_txt = font_s.render(f"Scale: {SCALE_FACTOR:.1f}x", True, TEXT_COLOR)
    virtual_surface.blit(scale_txt, (580, 620))

    # --- 最終スケーリング ---
    final_scale = get_drawing_scale()
    scaled_w, scaled_h = int(VIRTUAL_WIDTH * final_scale), int(VIRTUAL_HEIGHT * final_scale)
    final_blit_surface = pygame.transform.smoothscale(virtual_surface, (scaled_w, scaled_h))
    
    screen.fill((0, 0, 0))
    screen.blit(final_blit_surface, ((SCREEN_WIDTH - scaled_w)//2, (SCREEN_HEIGHT - scaled_h)//2))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
