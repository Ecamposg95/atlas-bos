import time
import webbrowser
import urllib.request
import sys
import threading
import tkinter as tk
from tkinter import ttk

class SplashScreen(threading.Thread):
    def __init__(self):
        super().__init__()
        self.root = None
        self.stop_event = threading.Event()

    def run(self):
        self.root = tk.Tk()
        self.root.overrideredirect(True) # Remove window decorations
        self.root.attributes('-topmost', True) # Keep on top
        
        # Dimensions - Larger for the new design
        width = 650
        height = 500
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width // 2) - (width // 2)
        y = (screen_height // 2) - (height // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")
        
        # Colors & Style
        bg_color = '#004d40' # Dark Teal Green approximation
        text_color = '#ffffff'
        
        # Main Frame
        main_frame = tk.Frame(self.root, bg=bg_color)
        main_frame.pack(fill='both', expand=True)

        # 1. Logo Section
        # Try to load logo
        try:
             import os
             # Look for logo in standard paths
             possible_paths = [
                 "app/static/img/logo_atlas2.png", 
                 "../app/static/img/logo_atlas2.png",
                 os.path.join(os.getcwd(), "app/static/img/logo_atlas2.png")
             ]
             
             logo_image = None
             for p in possible_paths:
                 if os.path.exists(p):
                     # Use subsample to resize if it's too big, assuming it might be large
                     # standard PhotoImage zoom/subsample is limited but works for basic scaling
                     img_raw = tk.PhotoImage(file=p)
                     # Simple heuristic: if width > 100, shrink it
                     if img_raw.width() > 100:
                         logo_image = img_raw.subsample(2, 2) # Reduce by half approx
                     else:
                         logo_image = img_raw
                     break
            
             if logo_image:
                 lbl_img = tk.Label(main_frame, image=logo_image, bg=bg_color)
                 lbl_img.image = logo_image
                 lbl_img.pack(pady=(20, 5))
             else:
                 # Logo Placeholder Circle "A"
                 canvas = tk.Canvas(main_frame, width=80, height=80, bg=bg_color, highlightthickness=0)
                 canvas.pack(pady=(20, 5))
                 canvas.create_oval(5, 5, 75, 75, outline="white", width=4)
                 canvas.create_text(40, 40, text="A", fill="white", font=("Arial", 40, "bold"))

        except Exception as e:
            print(f"Logo error: {e}")
            tk.Label(main_frame, text="A", font=("Arial", 40, "bold"), fg="white", bg=bg_color).pack(pady=(20, 5))

        # 2. Title "ATLAS"
        tk.Label(main_frame, text="RMAZH ERP", font=("Arial", 24, "bold"), fg="white", bg=bg_color).pack()
        
        # 3. Subtitle "Inicializando ATLAS ERP_CORE"
        tk.Label(main_frame, text="Inicializando ATLAS ERP_CORE", font=("Arial", 11), fg="#b2dfdb", bg=bg_color).pack(pady=(5, 10))
        
        # 4. Loading Text Steps (Dynamic)
        self.loading_label = tk.Label(main_frame, text="Cargando motor principal...", font=("Consolas", 9), fg="#e0f2f1", bg=bg_color)
        self.loading_label.pack(pady=2)
        
        self.steps = [
            "Cargando motor principal...", 
            "Levantando servicios backend...",
            "Conectando con módulos internos...",
            "Verificando integridad del sistema...",
            "Sincronizando componentes...",
            "Preparando entorno de trabajo...",
            "Sistema en proceso de arranque..."
        ]
        self.step_index = 0
        self.update_loading_text()

        # 5. Footer
        footer_frame = tk.Frame(main_frame, bg=bg_color)
        footer_frame.pack(side='bottom', pady=10)
        
        tk.Label(footer_frame, text="ERP_CORE • Powered by ATLAS Tech", font=("Arial", 9, "bold"), fg="white", bg=bg_color).pack()
        tk.Label(footer_frame, text="Startup mexicana • Ciudad de México", font=("Arial", 9, "bold"), fg="white", bg=bg_color).pack()

        # Bind ESC to stop manually if stuck
        self.root.bind('<Escape>', lambda e: self.stop())
        
        # Check for stop event periodically
        self.check_stop()
        
        self.root.mainloop()

    def update_loading_text(self):
        if self.step_index < len(self.steps):
            txt = self.steps[self.step_index]
            if self.loading_label.winfo_exists():
                self.loading_label.config(text=txt)
            self.step_index = (self.step_index + 1) % len(self.steps)
        
        if self.root and not self.stop_event.is_set():
            # Change text every 800ms to simulate activity
            self.root.after(800, self.update_loading_text)

    def check_stop(self):
        if self.stop_event.is_set():
            if self.root:
                self.root.quit()
        else:
            if self.root:
                self.root.after(100, self.check_stop)

    def stop(self):
        self.stop_event.set()

def wait_and_launch(url):
    # Start Splash Screen
    splash = SplashScreen()
    splash.start()
    
    print(f"Waiting for {url}...")
    max_retries = 30 # 30 seconds max wait
    count = 0
    
    while count < max_retries:
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    print("Server is ready! Launching browser...")
                    time.sleep(1) # Visual comfort
                    splash.stop()
                    splash.join()
                    webbrowser.open(url)
                    break
        except Exception:
            time.sleep(1)
            count += 1
            
    # Force close if timeout
    if splash.is_alive():
        splash.stop()
        splash.join()

if __name__ == "__main__":
    target_url = "http://127.0.0.1:8000/login"
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    wait_and_launch(target_url)
