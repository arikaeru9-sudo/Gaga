import pygame
import random
import math
import time 

pygame.init()

# --- 画面の初期設定 ---
info = pygame.display.Info()
SCREEN_WIDTH = info.current_w
SCREEN_HEIGHT = info.current_h
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.FULLSCREEN | pygame.RESIZABLE) 
pygame.display.set_caption("ステージ制迷路ダッシュ")

# --- 仮想画面設定 ---
VIRTUAL_WIDTH = 1280
VIRTUAL_HEIGHT = 720
virtual_surface = pygame.Surface((VIRTUAL_WIDTH, VIRTUAL_HEIGHT))

# プレイヤーとグリッドの共通サイズ
player_size = 60 
GRID_SIZE = player_size

# --- 💡 スケール機能変数 💡 ---
def calculate_auto_scale():
    scale_w = SCREEN_WIDTH / VIRTUAL_WIDTH
    scale_h = SCREEN_HEIGHT / VIRTUAL_HEIGHT
    return min(scale_w, scale_h)

SCALE_FACTOR = 1.0 
MAX_SCALE_FACTOR = 2.0
MIN_SCALE_FACTOR = 0.5
SCALE_STEP = 0.1

def get_drawing_scale():
    auto_scale = calculate_auto_scale()
    return auto_scale * SCALE_FACTOR

# --- 🎨 色の定義 ---
BRIGHT_UNDERGROUND_GRAY = (80, 80, 80) 
BLUE_BLOCK_COLOR = (50, 50, 200) 
RED_ENEMY_COLOR = (255, 0, 0) 
PURPLE_ENEMY_COLOR = (100, 0, 100) 
YELLOW_BLOCK_COLOR = (255, 255, 0) 
PLAYER_COLOR = (255, 255, 255) 
PLAYER_OVER_COLOR = (255, 100, 100) 
TEXT_COLOR = (255, 255, 255) # 白
HOME_QUIT_COLOR = (100, 100, 100)
CONTROLLER_BUTTON_COLOR = (100, 100, 100)
CONTROLLER_BUTTON_HOVER = (150, 150, 150)
SHATTER_PIECE_COLOR = (200, 200, 200, 200)

# --- 🟩 テクスチャ/モデル定義 ---
# テクスチャはロード処理を省略し、フォールバックの描画を使用
BLUE_BLOCK_TEXTURE = None
YELLOW_BLOCK_TEXTURE = None
PLAYER_TEXTURES = {'front': None, 'back': None, 'right': None, 'left': None}
PLAYER_CURRENT_ORIENTATION = 'front' 
SHATTERED_YELLOW_PIECES = []
SHATTERED_BLUE_PIECES = [] 
def prepare_shattered_textures(texture, num_pieces_per_side): return [] # ダミー

# --- 🟩 グローバルなワールド設定変数/フォント ---
GRID_WORLD_WIDTH = 50    
GRID_WORLD_HEIGHT = 50   
MAX_STAGE = 98 
CAMERA_SMOOTHING_FACTOR = 0.1 
MOVE_DURATION = 80 
PLAYER_MOVE_DELAY_INITIAL = 200 
PLAYER_MOVE_DELAY_REPEAT = MOVE_DURATION 
ENEMY_MOVE_INTERVAL_BASE = 500
PURPLE_ENEMY_MOVE_INTERVAL_BASE = 200
SHATTER_PIECE_COUNT = 9 # 3x3

JAPANESE_FONT = pygame.font.match_font('meiryo', bold=True) or pygame.font.match_font('msgothic') or None
font_title = pygame.font.Font(JAPANESE_FONT, 96) 
font_restart = pygame.font.Font(JAPANESE_FONT, 36)
font_score = pygame.font.Font(JAPANESE_FONT, 48)
font_message = pygame.font.Font(JAPANESE_FONT, 72)
font_clear = pygame.font.Font(JAPANESE_FONT, 74)

# --- 🟩 ゲーム状態変数 ---
game_state = 'HOME' 
player_x, player_y = 0.0, 0.0  
blocks = set() 
enemies_red = [] 
enemies_purple = [] 
yellow_blocks = [] 
last_red_enemy_move_time = 0
last_purple_enemy_move_time = 0 
ENEMY_MOVE_INTERVAL = ENEMY_MOVE_INTERVAL_BASE 
PURPLE_ENEMY_MOVE_INTERVAL = PURPLE_ENEMY_MOVE_INTERVAL_BASE
start_time = 0.0
end_time = 0.0
yellow_blocks_collected = 0
final_score = 0
is_moving = False
move_start_time = 0
start_pos = (0.0, 0.0)
target_pos = (0.0, 0.0)
current_grid_x = 0
current_grid_y = 0
last_player_move_time = 0
player_move_cooldown = 0 
move_queue = [] 
explosions = []
SHOW_CONTROLLER = True 
camera_target_x = 0.0
camera_target_y = 0.0
current_stage = 1 
unlocked_stage = 1 

# --- 🎮 コントローラー設定 (仮想画面基準で配置) 🎮 ---
BUTTON_SIZE = 100 
BUTTON_MARGIN = 20 
BUTTON_ALPHA = 150 
CONTROLLER_CENTER_X = VIRTUAL_WIDTH - BUTTON_MARGIN - (BUTTON_SIZE * 1.5)
CONTROLLER_CENTER_Y = VIRTUAL_HEIGHT - BUTTON_MARGIN - (BUTTON_SIZE * 1.5)

VIRTUAL_BUTTONS = [
    {'key': pygame.K_UP, 'rect': pygame.Rect(CONTROLLER_CENTER_X - BUTTON_SIZE // 2, CONTROLLER_CENTER_Y - BUTTON_SIZE * 1.5, BUTTON_SIZE, BUTTON_SIZE), 'label': '▲'},
    {'key': pygame.K_DOWN, 'rect': pygame.Rect(CONTROLLER_CENTER_X - BUTTON_SIZE // 2, CONTROLLER_CENTER_Y + BUTTON_SIZE * 0.5, BUTTON_SIZE, BUTTON_SIZE), 'label': '▼'},
    {'key': pygame.K_LEFT, 'rect': pygame.Rect(CONTROLLER_CENTER_X - BUTTON_SIZE * 1.5, CONTROLLER_CENTER_Y - BUTTON_SIZE // 2, BUTTON_SIZE, BUTTON_SIZE), 'label': '◀'},
    {'key': pygame.K_RIGHT, 'rect': pygame.Rect(CONTROLLER_CENTER_X + BUTTON_SIZE * 0.5, CONTROLLER_CENTER_Y - BUTTON_SIZE // 2, BUTTON_SIZE, BUTTON_SIZE), 'label': '▶'},
]

# --- 💡 スケール調整UIボタンの定義 💡 ---
SCALE_BUTTON_SIZE = 40
SCALE_BUTTON_MARGIN = 10
SCALE_BUTTON_Y = VIRTUAL_HEIGHT - SCALE_BUTTON_MARGIN - SCALE_BUTTON_SIZE

SCALE_BUTTONS = [
    {'action': 'reset', 'rect': pygame.Rect(VIRTUAL_WIDTH // 2 - SCALE_BUTTON_SIZE * 2 - SCALE_BUTTON_MARGIN * 2, SCALE_BUTTON_Y, SCALE_BUTTON_SIZE, SCALE_BUTTON_SIZE), 'label': 'R', 'key': pygame.K_F4},
    {'action': 'minus', 'rect': pygame.Rect(VIRTUAL_WIDTH // 2 - SCALE_BUTTON_SIZE - SCALE_BUTTON_MARGIN, SCALE_BUTTON_Y, SCALE_BUTTON_SIZE, SCALE_BUTTON_SIZE), 'label': '-', 'key': pygame.K_F3},
    {'action': 'plus', 'rect': pygame.Rect(VIRTUAL_WIDTH // 2 + SCALE_BUTTON_MARGIN, SCALE_BUTTON_Y, SCALE_BUTTON_SIZE, SCALE_BUTTON_SIZE), 'label': '+', 'key': pygame.K_F2},
]

# ----------------------------------------
# ダミーロジックとクラスの定義
# ----------------------------------------

class ExplosionPiece:
    def __init__(self, x, y, size, color):
        self.x = x
        self.y = y
        self.size = size
        self.color = color
        self.start_time = pygame.time.get_ticks()
        self.duration = random.randint(300, 600)
        angle = random.uniform(0, 2 * math.pi)
        speed = random.uniform(1, 3)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - 2 # 重力風
        self.gravity = 0.1
    
    def update(self):
        time_elapsed = pygame.time.get_ticks() - self.start_time
        if time_elapsed > self.duration:
            return False
        
        # 簡易物理演算
        self.x += self.vx
        self.y += self.vy
        self.vy += self.gravity
        return True

    def draw(self, surface, offset_x, offset_y):
        alpha = 255 - int(255 * (pygame.time.get_ticks() - self.start_time) / self.duration)
        temp_color = (self.color[0], self.color[1], self.color[2], max(0, alpha))
        
        s = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
        s.fill(temp_color)
        surface.blit(s, (self.x + offset_x, self.y + offset_y))

class Explosion:
    def __init__(self, grid_x, grid_y, is_yellow):
        self.pieces = []
        center_x = grid_x * GRID_SIZE
        center_y = grid_y * GRID_SIZE
        color = YELLOW_BLOCK_COLOR if is_yellow else BLUE_BLOCK_COLOR
        piece_size = GRID_SIZE // 3
        
        for i in range(SHATTER_PIECE_COUNT):
            piece_x = center_x + random.uniform(-GRID_SIZE/4, GRID_SIZE/4)
            piece_y = center_y + random.uniform(-GRID_SIZE/4, GRID_SIZE/4)
            self.pieces.append(ExplosionPiece(piece_x, piece_y, piece_size, color))

    def update(self):
        self.pieces = [p for p in self.pieces if p.update()]
        return bool(self.pieces)

    def draw(self, surface, offset_x, offset_y):
        for piece in self.pieces:
            piece.draw(surface, offset_x, offset_y)

class Enemy:
    def __init__(self, grid_x, grid_y, is_purple=False):
        self.grid_x = grid_x
        self.grid_y = grid_y
        self.is_purple = is_purple
        self.color = PURPLE_ENEMY_COLOR if is_purple else RED_ENEMY_COLOR
        self.x = float(grid_x * GRID_SIZE)
        self.y = float(grid_y * GRID_SIZE)

    def move_to(self, new_x, new_y):
        self.grid_x = round(new_x / GRID_SIZE)
        self.grid_y = round(new_y / GRID_SIZE)
        self.x = float(self.grid_x * GRID_SIZE)
        self.y = float(self.grid_y * GRID_SIZE)

    def get_rect(self):
        return pygame.Rect(self.x, self.y, GRID_SIZE, GRID_SIZE)

def generate_stage(stage):
    """ステージ生成のダミーロジック"""
    global blocks, enemies_red, enemies_purple, yellow_blocks
    global current_grid_x, current_grid_y, player_x, player_y
    global ENEMY_MOVE_INTERVAL, PURPLE_ENEMY_MOVE_INTERVAL

    blocks.clear()
    enemies_red.clear()
    enemies_purple.clear()
    yellow_blocks.clear()
    
    # スピード調整 (ステージが進むほど敵が速くなるダミー)
    ENEMY_MOVE_INTERVAL = max(100, ENEMY_MOVE_INTERVAL_BASE - stage * 50)
    PURPLE_ENEMY_MOVE_INTERVAL = max(50, PURPLE_ENEMY_MOVE_INTERVAL_BASE - stage * 20)
    
    # プレイヤー初期位置 (中央)
    current_grid_x, current_grid_y = 0, 0
    player_x, player_y = float(current_grid_x * GRID_SIZE), float(current_grid_y * GRID_SIZE)
    
    # ダミーの迷路生成 (ステージ数に応じて複雑化)
    num_blocks = 20 + stage * 5
    num_enemies = 1 + stage // 5
    
    occupied_positions = {(0, 0)} # プレイヤー位置
    
    for _ in range(num_blocks):
        x = random.randint(-GRID_WORLD_WIDTH // 2, GRID_WORLD_WIDTH // 2)
        y = random.randint(-GRID_WORLD_HEIGHT // 2, GRID_WORLD_HEIGHT // 2)
        if (x, y) not in occupied_positions:
            blocks.add((x, y))
            occupied_positions.add((x, y))

    for _ in range(num_enemies):
        is_purple = random.random() < 0.5 
        while True:
            x = random.randint(-GRID_WORLD_WIDTH // 2, GRID_WORLD_WIDTH // 2)
            y = random.randint(-GRID_WORLD_HEIGHT // 2, GRID_WORLD_HEIGHT // 2)
            if (x, y) not in occupied_positions and abs(x) + abs(y) > 5:
                enemy = Enemy(x, y, is_purple)
                enemies_red.append(enemy) if not is_purple else enemies_purple.append(enemy)
                occupied_positions.add((x, y))
                break
                
    # ダミーの黄色ブロック生成
    for _ in range(2 + stage):
        while True:
            x = random.randint(-GRID_WORLD_WIDTH // 2, GRID_WORLD_WIDTH // 2)
            y = random.randint(-GRID_WORLD_HEIGHT // 2, GRID_WORLD_HEIGHT // 2)
            if (x, y) not in occupied_positions:
                yellow_blocks.append((x * GRID_SIZE, y * GRID_SIZE))
                occupied_positions.add((x, y))
                break

def initialize_game(stage):
    """ゲーム開始時の初期化処理"""
    global game_state, start_time, yellow_blocks_collected, current_stage, explosions
    
    current_stage = stage
    generate_stage(stage)
    
    start_time = time.time()
    yellow_blocks_collected = 0
    explosions.clear()
    game_state = 'PLAYING'

def calculate_score(time_taken, yellow_collected):
    """スコア計算のダミーロジック"""
    BLOCK_SCORE_MULTIPLIER = 10
    BASE_MAX_SCORE = 1000
    TIME_PENALTY_MULTIPLIER = 1 
    time_score = max(0, BASE_MAX_SCORE - int(time_taken * TIME_PENALTY_MULTIPLIER))
    return yellow_collected * BLOCK_SCORE_MULTIPLIER + time_score

def enemy_move_logic(enemy_list, interval):
    """敵の移動ロジックのダミー (ランダム移動/追跡)"""
    global last_red_enemy_move_time, last_purple_enemy_move_time, blocks

    last_move_time_ref = last_red_enemy_move_time if enemy_list is enemies_red else last_purple_enemy_move_time
    
    if pygame.time.get_ticks() - last_move_time_ref < interval:
        return

    for enemy in enemy_list:
        start_gx, start_gy = enemy.grid_x, enemy.grid_y
        
        if enemy.is_purple:
            # 追跡ロジック (ダミー: プレイヤー方向に一歩)
            target_gx, target_gy = current_grid_x, current_grid_y
            dx = 0
            dy = 0
            
            if target_gx > start_gx: dx = 1
            elif target_gx < start_gx: dx = -1
            
            if target_gy > start_gy: dy = 1
            elif target_gy < start_gy: dy = -1
            
            if dx != 0 and dy != 0 and random.random() < 0.5: # 縦横どちらか優先
                dx = 0 if abs(target_gx - start_gx) < abs(target_gy - start_gy) else dx 
                dy = 0 if abs(target_gx - start_gx) >= abs(target_gy - start_gy) else dy
                
            if (start_gx + dx, start_gy + dy) in blocks:
                 dx, dy = 0, 0 # ブロック衝突で停止 (簡易)

        else:
            # 赤い敵: ランダム移動
            moves = [(1, 0), (-1, 0), (0, 1), (0, -1)]
            random.shuffle(moves)
            dx, dy = 0, 0
            for move_dx, move_dy in moves:
                if (start_gx + move_dx, start_gy + move_dy) not in blocks:
                    dx, dy = move_dx, move_dy
                    break
        
        enemy.move_to((start_gx + dx) * GRID_SIZE, (start_gy + dy) * GRID_SIZE)

    if enemy_list is enemies_red:
        last_red_enemy_move_time = pygame.time.get_ticks()
    else:
        last_purple_enemy_move_time = pygame.time.get_ticks()

def check_collision():
    """衝突判定ロジックのダミー"""
    global game_state, enemies_red, enemies_purple, yellow_blocks, yellow_blocks_collected, explosions
    
    player_rect = pygame.Rect(player_x, player_y, GRID_SIZE, GRID_SIZE)

    # 敵との衝突判定
    all_enemies = enemies_red + enemies_purple
    for enemy in all_enemies:
        if player_rect.colliderect(enemy.get_rect()):
            game_state = 'OVER'
            return

    # 黄色ブロックの回収判定
    yellow_blocks_to_remove = []
    for yb_x, yb_y in yellow_blocks:
        yb_rect = pygame.Rect(yb_x, yb_y, GRID_SIZE, GRID_SIZE)
        if player_rect.colliderect(yb_rect):
            yellow_blocks_to_remove.append((yb_x, yb_y))
            yellow_blocks_collected += 1
            explosions.append(Explosion(round(yb_x / GRID_SIZE), round(yb_y / GRID_SIZE), True))

    for yb in yellow_blocks_to_remove:
        yellow_blocks.remove(yb)

# ----------------------------------------
# ユーティリティ関数 (スケール/描画)
# ----------------------------------------

# (update_player_transition, attempt_player_move_from_queue, get_virtual_mouse_pos, 
# draw_virtual_controller, draw_scale_buttons は変更なし、上記のコードブロックに含まれている)

# ----------------------------------------
# 🎮 ゲームループ 🎮
# ----------------------------------------
clock = pygame.time.Clock()
running = True

while running:
    current_time_ms = pygame.time.get_ticks()
    
    # --- イベント処理 ---
    for event in pygame.event.get():
        if event.type == pygame.QUIT: running = False
        if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE: running = False
        
        if event.type == pygame.VIDEORESIZE:
            SCREEN_WIDTH, SCREEN_HEIGHT = event.size
            screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.FULLSCREEN | pygame.RESIZABLE)
        
        # キーボードによる機能操作
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_F1: SHOW_CONTROLLER = not SHOW_CONTROLLER
            elif event.key == pygame.K_F2: SCALE_FACTOR = min(MAX_SCALE_FACTOR, SCALE_FACTOR + SCALE_STEP)
            elif event.key == pygame.K_F3: SCALE_FACTOR = max(MIN_SCALE_FACTOR, SCALE_FACTOR - SCALE_STEP)
            elif event.key == pygame.K_F4: SCALE_FACTOR = 1.0

            if game_state in ['HOME', 'CLEAR', 'OVER']:
                if event.key == pygame.K_SPACE or event.key == pygame.K_RETURN:
                    # ステージ再開/開始
                    initialize_game(current_stage)

        # キーボードによる移動入力処理
        if event.type == pygame.KEYDOWN and game_state == 'PLAYING':
            if event.key in [pygame.K_LEFT, pygame.K_RIGHT, pygame.K_UP, pygame.K_DOWN, pygame.K_w, pygame.K_a, pygame.K_s, pygame.K_d]:
                key_to_add = event.key
                if key_to_add == pygame.K_w: key_to_add = pygame.K_UP
                elif key_to_add == pygame.K_a: key_to_add = pygame.K_LEFT
                elif key_to_add == pygame.K_s: key_to_add = pygame.K_DOWN
                elif key_to_add == pygame.K_d: key_to_add = pygame.K_RIGHT
                    
                move_queue = [key for key in move_queue if key not in [pygame.K_LEFT, pygame.K_RIGHT, pygame.K_UP, pygame.K_DOWN]]
                move_queue.append(key_to_add)

                if player_move_cooldown == 0 or current_time_ms - last_player_move_time >= player_move_cooldown:
                    player_move_cooldown = 0
                    last_player_move_time = current_time_ms 
        
        if event.type == pygame.KEYUP:
            if event.key in [pygame.K_LEFT, pygame.K_RIGHT, pygame.K_UP, pygame.K_DOWN, pygame.K_w, pygame.K_a, pygame.K_s, pygame.K_d]:
                key_to_remove = event.key
                if key_to_remove == pygame.K_w: key_to_remove = pygame.K_UP
                elif key_to_remove == pygame.K_a: key_to_remove = pygame.K_LEFT
                elif key_to_remove == pygame.K_s: key_to_remove = pygame.K_DOWN
                elif key_to_remove == pygame.K_d: key_to_remove = pygame.K_RIGHT
                
                if key_to_remove in move_queue: move_queue.remove(key_to_remove) 
                
                keys_pressed = pygame.key.get_pressed()
                if not (keys_pressed[pygame.K_LEFT] or keys_pressed[pygame.K_RIGHT] or keys_pressed[pygame.K_UP] or keys_pressed[pygame.K_DOWN] or 
                        keys_pressed[pygame.K_w] or keys_pressed[pygame.K_a] or keys_pressed[pygame.K_s] or keys_pressed[pygame.K_d]):
                    player_move_cooldown = 0; last_player_move_time = 0; move_queue = [] 

        # マウス/タッチダウンイベント処理 (スケールボタン)
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            virtual_pos = get_virtual_mouse_pos(event.pos)
            
            # --- スケール調整ボタンの処理 ---
            if game_state in ['PLAYING', 'CLEAR', 'OVER']:
                global SCALE_FACTOR
                for scale_button in SCALE_BUTTONS:
                    if scale_button['rect'].collidepoint(virtual_pos):
                        if scale_button['action'] == 'plus':
                            SCALE_FACTOR = min(MAX_SCALE_FACTOR, SCALE_FACTOR + SCALE_STEP)
                        elif scale_button['action'] == 'minus':
                            SCALE_FACTOR = max(MIN_SCALE_FACTOR, SCALE_FACTOR - SCALE_STEP)
                        elif scale_button['action'] == 'reset':
                            SCALE_FACTOR = 1.0
                        break
            
            # --- 仮想コントローラーの処理 ---
            if game_state == 'PLAYING' and SHOW_CONTROLLER:
                for button in VIRTUAL_BUTTONS:
                    if button['rect'].collidepoint(virtual_pos):
                        move_queue.append(button['key'])
                        player_move_cooldown = 0
                        last_player_move_time = current_time_ms
                        break 
                        
        if event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            # (コントローラーの長押しリセットロジックは省略)
            pass

    # --- ゲームロジック更新 ---
    if game_state == 'PLAYING':
        update_player_transition(current_time_ms)
        if not is_moving: attempt_player_move_from_queue(current_time_ms)
        
        # 敵の移動ロジックを実行
        if not is_moving: # プレイヤーが停止しているときのみ敵を動かす (簡易)
            enemy_move_logic(enemies_red, ENEMY_MOVE_INTERVAL)
            enemy_move_logic(enemies_purple, PURPLE_ENEMY_MOVE_INTERVAL)
        
        # 衝突判定を実行
        check_collision()

    # 爆発エフェクトの更新
    active_explosions = []
    for exp in explosions:
        if exp.update(): 
            active_explosions.append(exp)
    explosions = active_explosions

    # ----------------------------------------
    # 🎨 画面描画 (仮想画面への描画) 🎨
    # ----------------------------------------
    V_W, V_H = VIRTUAL_WIDTH, VIRTUAL_HEIGHT
    virtual_surface.fill(BRIGHT_UNDERGROUND_GRAY)
    
    # 描画オフセットを計算
    player_center_x, player_center_y = player_x + GRID_SIZE // 2, player_y + GRID_SIZE // 2
    camera_target_x += (player_center_x - camera_target_x) * CAMERA_SMOOTHING_FACTOR
    camera_target_y += (player_center_y - camera_target_y) * CAMERA_SMOOTHING_FACTOR
    camera_offset_x = V_W // 2 - int(camera_target_x)
    camera_offset_y = V_H // 2 - int(camera_target_y)

    if game_state == 'HOME':
        virtual_surface.fill((0, 0, 0)) 
        title_text = font_title.render("ブロック迷路ダッシュ", True, TEXT_COLOR)
        title_rect = title_text.get_rect(center=(V_W // 2, V_H // 2 - 100))
        virtual_surface.blit(title_text, title_rect)
        instruction_text = font_restart.render("スペースキーまたはエンターキーでステージ1を開始", True, TEXT_COLOR)
        instruction_rect = instruction_text.get_rect(center=(V_W // 2, V_H // 2 + 50))
        virtual_surface.blit(instruction_text, instruction_rect)
    else:
        # １．青いブロック（壁）の描画
        for gx, gy in blocks:
            rect = pygame.Rect(gx * GRID_SIZE + camera_offset_x, gy * GRID_SIZE + camera_offset_y, GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(virtual_surface, BLUE_BLOCK_COLOR, rect)
            
        # ２．黄色いブロックの描画
        for yb_x, yb_y in yellow_blocks:
            rect = pygame.Rect(yb_x + camera_offset_x, yb_y + camera_offset_y, GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(virtual_surface, YELLOW_BLOCK_COLOR, rect)

        # ３．敵の描画
        all_enemies = enemies_red + enemies_purple
        for enemy in all_enemies:
            rect = pygame.Rect(enemy.x + camera_offset_x, enemy.y + camera_offset_y, GRID_SIZE, GRID_SIZE)
            pygame.draw.rect(virtual_surface, enemy.color, rect)

        # ４．プレイヤーの描画 (ダミー: 白い四角)
        player_rect = pygame.Rect(player_x + camera_offset_x, player_y + camera_offset_y, GRID_SIZE, GRID_SIZE)
        pygame.draw.rect(virtual_surface, PLAYER_COLOR, player_rect)
        
        # ５．爆発エフェクトの描画
        for exp in explosions:
            exp.draw(virtual_surface, camera_offset_x, camera_offset_y)
        
        # ６．UI描画
        stage_text = font_score.render(f"ステージ: {current_stage}", True, TEXT_COLOR) 
        virtual_surface.blit(stage_text, (10, 10))

        # 収集数表示
        collect_text = font_score.render(f"黄: {yellow_blocks_collected}", True, YELLOW_BLOCK_COLOR) 
        virtual_surface.blit(collect_text, (10, 10 + stage_text.get_height() + 5))

        # 状態メッセージ
        if game_state == 'CLEAR':
            time_taken = time.time() - start_time
            score = calculate_score(time_taken, yellow_blocks_collected)
            final_score = score # スコアをグローバル変数に格納
            
            message = font_clear.render("ステージクリア！", True, HOME_QUIT_COLOR)
            score_msg = font_score.render(f"スコア: {score}", True, TEXT_COLOR)
            next_msg = font_restart.render("スペースキーまたはエンターキーで次のステージへ", True, TEXT_COLOR)
            
            message_rect = message.get_rect(center=(V_W // 2, V_H // 2 - 100))
            score_rect = score_msg.get_rect(center=(V_W // 2, V_H // 2))
            next_rect = next_msg.get_rect(center=(V_W // 2, V_H // 2 + 80))
            
            virtual_surface.blit(message, message_rect)
            virtual_surface.blit(score_msg, score_rect)
            virtual_surface.blit(next_msg, next_rect)
        
        elif game_state == 'OVER':
            message = font_message.render("ゲームオーバー", True, RED_ENEMY_COLOR)
            retry_msg = font_restart.render("スペースキーまたはエンターキーで再開", True, TEXT_COLOR)
            
            message_rect = message.get_rect(center=(V_W // 2, V_H // 2 - 50))
            retry_rect = retry_msg.get_rect(center=(V_W // 2, V_H // 2 + 50))
            
            virtual_surface.blit(message, message_rect)
            virtual_surface.blit(retry_msg, retry_rect)

        # UI表示
        scale_display_text = font_restart.render(f"表示スケール: {SCALE_FACTOR:.1f}x", True, HOME_QUIT_COLOR)
        scale_display_rect = scale_display_text.get_rect(left=V_W // 2 + SCALE_BUTTON_SIZE * 2 + SCALE_BUTTON_MARGIN * 2, bottom=V_H - 10)
        virtual_surface.blit(scale_display_text, scale_display_rect)
        
        f1_text = font_restart.render(f"[F1]: コントローラ表示切替", True, HOME_QUIT_COLOR)
        f1_rect = f1_text.get_rect(right=V_W - 10, bottom=V_H - 10)
        virtual_surface.blit(f1_text, f1_rect)
        
        draw_virtual_controller(virtual_surface)
        draw_scale_buttons(virtual_surface)

    # ----------------------------------------
    # 🖥️ 物理画面への最終描画 (スケーリング処理) 🖥️
    # ----------------------------------------
    
    final_scale = get_drawing_scale()
    
    scaled_surface = pygame.transform.scale(
        virtual_surface, 
        (int(VIRTUAL_WIDTH * final_scale), int(VIRTUAL_HEIGHT * final_scale))
    )
    
    scaled_width = scaled_surface.get_width()
    scaled_height = scaled_surface.get_height()
    
    draw_x = (SCREEN_WIDTH - scaled_width) // 2
    draw_y = (SCREEN_HEIGHT - scaled_height) // 2
    
    screen.fill((0, 0, 0)) 
    screen.blit(scaled_surface, (draw_x, draw_y))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
