import time
import json
from notifications import Alerts
import re
import platform
import sys
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from browser_setup import create_driver
from selenium.webdriver.chrome.options import Options

class SigninMonitorV3:
    def __init__(self, target_url=None, check_interval=15):
        """
        初始化监控器
        
        参数:
        - target_url: 目标签到页面URL，默认为None（需要手动指定）
        - check_interval: 检查频率（秒），默认15秒
        """
        self.driver = None
        self.previous_signin_num = None
        self.check_interval = check_interval
        self.attempt_count = 0
        
        # 设置目标URL，如果未提供则使用默认值
        if target_url:
            self.target_url = target_url
        else:
            # 默认URL，保持向后兼容
            self.target_url = "https://oc.sjtu.edu.cn/courses/95353/external_tools/6650"
        
        self.alerts = Alerts(self.target_url)
        self.state_file = Path(__file__).resolve().parent / "data" / f"signin-state-{self.alerts.course}.json"
        try:
            self.previous_record = json.loads(self.state_file.read_text(encoding="utf-8"))
            self.previous_signin_num = self.previous_record.get("num")
        except (OSError, ValueError, AttributeError):
            self.previous_record = None
        self.current_record = None

        print(f"🎯 目标URL: {self.target_url}")
        print(f"⏰ 检查频率: {self.check_interval}秒")
        
    def setup_driver(self):
        """设置Chrome驱动"""
        chrome_options = Options()
        
        profile_dir = Path(__file__).parent / "profiles" / self.alerts.course
        profile_dir.mkdir(parents=True, exist_ok=True)
        chrome_options.add_argument(f"--user-data-dir={profile_dir.resolve()}")

        # 禁用自动化特征检测
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # 添加常用参数
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        try:
            self.driver = create_driver(chrome_options)
            print("✅ 浏览器驱动初始化成功")
            return True
        except Exception as e:
            print(f"❌ 驱动初始化失败: {e}")
            return False
    
    def login_is_ready(self):
        """Require the actual course tool page and a signed-in Canvas control."""
        self.driver.switch_to.default_content()
        from urllib.parse import urlsplit
        actual = urlsplit(self.driver.current_url)
        target = urlsplit(self.target_url)
        if actual.hostname != target.hostname or actual.path.rstrip('/') != target.path.rstrip('/'):
            return False
        controls = self.driver.find_elements(
            By.CSS_SELECTOR,
            "#global_nav_profile_link, a[href='/logout'], form[action='/logout']"
        )
        return bool(controls)

    def wait_for_manual_login(self):
        """Reuse the saved session, or wait for manual authentication."""
        print("正在打开课程页面并检查保存的登录状态……")
        self.driver.get(self.target_url)
        print("如出现登录页面，请在浏览器中登录。确认登录有效后将自动开始，无需按回车。")
        while True:
            try:
                if self.login_is_ready():
                    print("登录状态有效，自动开始监控。")
                    return True
                # After an authentication redirect, Canvas can land on the home page.
                from urllib.parse import urlsplit
                current = urlsplit(self.driver.current_url)
                target = urlsplit(self.target_url)
                if current.hostname == target.hostname and current.path.rstrip('/') != target.path.rstrip('/'):
                    controls = self.driver.find_elements(By.CSS_SELECTOR, "#global_nav_profile_link")
                    if controls:
                        self.driver.get(self.target_url)
            except Exception as exc:
                if "invalid session id" in str(exc).lower() or "no such window" in str(exc).lower():
                    raise
            time.sleep(3)

    def find_and_switch_to_signin_iframe(self):
        """查找并切换到签到iframe"""
        print("\n🔍 查找签到iframe...")
        
        # 等待页面完全加载
        time.sleep(5)
        
        # 查找所有iframe
        iframes = self.driver.find_elements(By.TAG_NAME, "iframe")
        print(f"找到 {len(iframes)} 个iframe")
        
        for i, iframe in enumerate(iframes):
            try:
                src = iframe.get_attribute("src") or ""
                print(f"iframe {i+1}: {src[:80]}{'...' if len(src) > 80 else ''}")
                
                # 切换到iframe
                self.driver.switch_to.frame(iframe)
                
                # 检查是否包含签到相关元素
                page_text = self.driver.page_source.lower()
                sign_keywords = ['签到', '签', 'rollcall', 'attendance', '考勤', '点名']
                
                for keyword in sign_keywords:
                    if keyword in page_text:
                        print(f"✅ 已切换到第 {i+1} 个iframe，内容包含签到信息")
                        
                        # 保存iframe内容用于调试
                        with open('iframe_content.html', 'w', encoding='utf-8') as f:
                            f.write(self.driver.page_source[:5000])
                        print("💾 已保存iframe内容到 iframe_content.html")
                        
                        return True
                
                # 没有找到签到信息，切回主文档
                self.driver.switch_to.default_content()
                
            except Exception as e:
                print(f"⚠️  处理iframe {i+1} 失败: {e}")
                try:
                    self.driver.switch_to.default_content()
                except:
                    pass
                continue
        
        print("❌ 未找到包含签到信息的iframe")
        return False
    
    def get_signin_number_from_first_rows(self):
        """Use the shared labelled-column parser; reject unlabelled numbers."""
        parser = Path(__file__).resolve().parent / "edge-signin-monitor" / "parser.js"
        source = parser.read_text(encoding="utf-8-sig")
        self.current_record = self.driver.execute_script(source + ";return SigninParser.parse(document);")
        if self.current_record:
            print(f"签到记录: {self.current_record['num']} · {self.current_record.get('status', '')}")
            return self.current_record["num"]
        print("未识别到带签到号表头的记录，保留上次状态；请检查页面。")
        return None

    def fallback_find_signin_number(self):
        return self.get_signin_number_from_first_rows()

    def check_signin_number(self):
        """检查签到号"""
        self.attempt_count += 1
        print(f"\n[{time.strftime('%H:%M:%S')}] 第 {self.attempt_count} 次检查")
        
        try:
            # 刷新页面获取最新数据
            print("🔄 刷新页面...")
            self.driver.switch_to.default_content()
            self.driver.refresh()
            time.sleep(5)
            if not self.login_is_ready():
                self.wait_for_manual_login()
            
            # 查找并切换到签到iframe
            if self.find_and_switch_to_signin_iframe():
                # 获取签到号
                current_num = self.get_signin_number_from_first_rows()
                
                if current_num:
                    record = self.current_record
                    previous = self.previous_record
                    changed = previous is not None and previous.get("key") != record["key"]
                    became_active = previous is not None and not previous.get("active") and record.get("active")
                    should_alert = not record.get("ended") and ((previous is None and record.get("active")) or changed or became_active)
                    # Persist before alerting, avoiding duplicates after process restart.
                    self.state_file.parent.mkdir(parents=True, exist_ok=True)
                    self.state_file.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
                    self.previous_record = record
                    self.previous_signin_num = current_num
                    if should_alert:
                        self.alerts.notify(previous.get("num", "首次发现") if previous else "首次发现", current_num)
                    else:
                        print("已保存签到基准，没有新提醒。")
                else:
                    print("⚠️ 未找到有效签到记录")
            else:
                print("❌ 无法访问签到页面")
                
            # 切回主文档，为下次刷新做准备
            self.driver.switch_to.default_content()
            
        except Exception as e:
            print(f"❌ 检查过程中出错: {e}")
            try:
                self.driver.switch_to.default_content()
            except:
                pass
    
    def alert_sound(self):
        """发出警报声音"""
        system = platform.system()
        
        try:
            if system == "Windows":
                import winsound
                for i in range(5):
                    winsound.Beep(1000 + i*100, 300)
                    time.sleep(0.1)
            elif system == "Darwin":  # macOS
                import os
                os.system('say "签到号变化"')
            elif system == "Linux":
                import os
                for _ in range(3):
                    os.system('echo -e "\a"')
                    time.sleep(0.2)
            else:
                print("\a\a\a")  # 通用响铃字符
                
            print("🔔 签到号变化警报已触发！")
            
        except Exception as e:
            print(f"⚠️  声音警报失败: {e}")
            # 视觉警报
            print("!" * 50)
            print("!!! 签到号已变化 !!!")
            print("!" * 50)
    
    def run_monitoring(self):
        """运行监控循环"""
        print("\n🎯 开始监控签到号变化")
        print(f"📈 检查频率: 每{self.check_interval}秒一次")
        print("按下 Ctrl+C 停止监控\n")
        
        # 首次检查
        self.check_signin_number()
        
        try:
            while True:
                # 等待间隔时间
                for remaining in range(self.check_interval, 0, -1):
                    print(f"\r⏳ 下次检查倒计时: {remaining}秒", end='')
                    time.sleep(1)
                print()
                
                # 执行检查
                self.check_signin_number()
                
        except KeyboardInterrupt:
            print("\n\n🛑 监控已停止")
    
    def run(self):
        """运行主程序"""
        print("="*60)
        print("上海交通大学签到号监控系统 V3.1")
        print("="*60)
        
        # 初始化驱动
        if not self.setup_driver():
            return
        
        try:
            # 等待手动登录
            if self.wait_for_manual_login():
                # 开始监控
                self.run_monitoring()
        except KeyboardInterrupt:
            print("监控已停止。")
        except Exception as e:
            print(f"❌ 程序运行出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.alerts.close()
            if self.driver:
                print("\n🧹 正在清理资源...")
                self.driver.quit()
                print("✅ 浏览器已关闭")
            
            print("\n📊 监控统计:")
            print(f"   检查次数: {self.attempt_count}")
            print(f"   最后签到号: {self.previous_signin_num}")

# 调试函数：详细分析表格结构
def analyze_table_structure(target_url=None, check_interval=15):
    """详细分析页面中的表格结构
    
    参数:
    - target_url: 目标签到页面URL
    - check_interval: 检查频率（秒）
    """
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    
    # 使用提供的URL或默认值
    if not target_url:
        target_url = "https://oc.sjtu.edu.cn/courses/95353/external_tools/6650"
    
    driver = create_driver(chrome_options)
    
    try:
        print(f"🎯 分析目标URL: {target_url}")
        driver.get(target_url)
        
        print("⏳ 请手动登录，然后按回车继续...")
        input()
        
        print("\n🔍 详细分析表格结构...")
        
        # 查找所有iframe
        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        print(f"找到 {len(iframes)} 个iframe")
        
        for i, iframe in enumerate(iframes):
            src = iframe.get_attribute("src") or ""
            if "mlearning" in src or "rollcall" in src or "lms" in src:
                print(f"\n切换到iframe {i+1}: {src[:80]}...")
                
                driver.switch_to.frame(iframe)
                
                # 查找所有表格
                tables = driver.find_elements(By.TAG_NAME, "table")
                print(f"iframe内找到 {len(tables)} 个表格")
                
                for table_idx, table in enumerate(tables):
                    print(f"\n  表格 {table_idx+1} 分析:")
                    
                    # 获取所有行
                    rows = table.find_elements(By.TAG_NAME, "tr")
                    print(f"    行数: {len(rows)}")
                    
                    # 显示前3行的详细内容
                    for row_idx, row in enumerate(rows[:3]):
                        row_text = row.text.strip()
                        print(f"\n    行 {row_idx+1}:")
                        print(f"      文本: '{row_text}'")
                        
                        # 检查是否为纯数字
                        if row_text.isdigit():
                            print(f"      ✅ 纯数字行!")
                        elif re.search(r'\d', row_text):
                            print(f"      🔢 包含数字: {re.findall(r'\d+', row_text)}")
                        else:
                            print(f"      📝 纯文字行")
                        
                        # 显示HTML片段
                        html_snippet = row.get_attribute('outerHTML')
                        if len(html_snippet) > 200:
                            html_snippet = html_snippet[:200] + "..."
                        print(f"      HTML: {html_snippet}")
                
                driver.switch_to.default_content()
                break  # 只分析第一个包含签到信息的iframe
        
        print("\n✅ 表格结构分析完成")
        
    except Exception as e:
        print(f"分析出错: {e}")
    finally:
        driver.quit()

def print_usage():
    """打印使用说明"""
    print("="*70)
    print("上海交通大学Canvas签到号监控系统 V3.1")
    print("="*70)
    print("\n使用方法:")
    print("1. 正常监控模式:")
    print("   python signin_monitor_v3.py [目标URL] [检查间隔]")
    print("   示例: python signin_monitor_v3.py https://oc.sjtu.edu.cn/courses/95353/external_tools/6650")
    print()
    print("2. 调试分析模式:")
    print("   python signin_monitor_v3.py --analyze [目标URL]")
    print("   示例: python signin_monitor_v3.py --analyze https://oc.sjtu.edu.cn/courses/95353/external_tools/6650")
    print()
    print("3. 默认模式（使用默认URL和15秒间隔）:")
    print("   python signin_monitor_v3.py")
    print("="*70)

if __name__ == "__main__":
    # 解析命令行参数
    target_url = None
    check_interval = 15
    run_mode = "monitor"  # 默认监控模式
    
    # 处理命令行参数
    if len(sys.argv) > 1:
        if sys.argv[1] == "--analyze":
            run_mode = "analyze"
            if len(sys.argv) > 2:
                target_url = sys.argv[2]
        elif sys.argv[1] == "--help" or sys.argv[1] == "-h":
            print_usage()
            sys.exit(0)
        else:
            # 第一个参数是URL
            target_url = sys.argv[1]
            if len(sys.argv) > 2:
                try:
                    check_interval = int(sys.argv[2])
                except ValueError:
                    print(f"⚠️  检查间隔参数无效，使用默认值 {check_interval} 秒")
    
    if run_mode == "analyze":
        # 调试分析模式
        analyze_table_structure(target_url, check_interval)
    else:
        # 正常监控模式
        if target_url:
            print(f"📋 使用自定义URL: {target_url}")
            print(f"⏰ 检查间隔: {check_interval}秒")
        
        monitor = SigninMonitorV3(target_url=target_url, check_interval=check_interval)
        monitor.run()