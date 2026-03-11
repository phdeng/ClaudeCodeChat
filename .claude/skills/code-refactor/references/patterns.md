# 常见重构模式示例

## 1. 提取函数 (Extract Function)

### Before
```python
def process_user_data(user):
    # 验证邮箱
    if not user.email or '@' not in user.email:
        raise ValueError("Invalid email")
    
    # ... 其他处理
    
def process_admin_data(admin):
    # 验证邮箱（重复）
    if not admin.email or '@' not in admin.email:
        raise ValueError("Invalid email")
    
    # ... 其他处理
```

### After
```python
def validate_email(email: str) -> None:
    """验证邮箱格式，无效则抛出 ValueError"""
    if not email or '@' not in email:
        raise ValueError("Invalid email")

def process_user_data(user):
    validate_email(user.email)
    # ... 其他处理
    
def process_admin_data(admin):
    validate_email(admin.email)
    # ... 其他处理
```

---

## 2. 模板方法模式 (Template Method)

### Before
```python
class PDFExporter:
    def export(self, data):
        formatted = self._format_header(data)
        formatted += self._format_body(data)
        formatted += self._format_footer(data)
        self._write_pdf(formatted)
        self._send_notification("PDF exported")

class ExcelExporter:
    def export(self, data):
        formatted = self._format_header(data)  # 重复结构
        formatted += self._format_body(data)
        formatted += self._format_footer(data)
        self._write_excel(formatted)
        self._send_notification("Excel exported")
```

### After
```python
from abc import ABC, abstractmethod

class BaseExporter(ABC):
    """导出器基类，定义导出流程模板"""
    
    def export(self, data):
        formatted = self._format_header(data)
        formatted += self._format_body(data)
        formatted += self._format_footer(data)
        self._write_output(formatted)
        self._send_notification(f"{self.format_name} exported")
    
    @property
    @abstractmethod
    def format_name(self) -> str:
        pass
    
    @abstractmethod
    def _write_output(self, content: str) -> None:
        pass

class PDFExporter(BaseExporter):
    format_name = "PDF"
    def _write_output(self, content): 
        self._write_pdf(content)

class ExcelExporter(BaseExporter):
    format_name = "Excel"
    def _write_output(self, content): 
        self._write_excel(content)
```

---

## 3. 策略模式 (Strategy Pattern)

### Before
```python
def calculate_price(product, discount_type):
    if discount_type == "percentage":
        return product.price * 0.9
    elif discount_type == "fixed":
        return product.price - 10
    elif discount_type == "buy_one_get_one":
        return product.price / 2
    # 每增加折扣类型都要改这里
```

### After
```python
from typing import Protocol

class DiscountStrategy(Protocol):
    def apply(self, price: float) -> float: ...

class PercentageDiscount:
    def __init__(self, rate: float = 0.1):
        self.rate = rate
    def apply(self, price: float) -> float:
        return price * (1 - self.rate)

class FixedDiscount:
    def __init__(self, amount: float = 10):
        self.amount = amount
    def apply(self, price: float) -> float:
        return max(0, price - self.amount)

class BuyOneGetOneDiscount:
    def apply(self, price: float) -> float:
        return price / 2

def calculate_price(product, strategy: DiscountStrategy) -> float:
    return strategy.apply(product.price)

# 使用
price = calculate_price(product, PercentageDiscount(0.15))
```

---

## 4. React Hooks 提取

### Before
```jsx
function UserProfile() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        fetch('/api/user')
            .then(res => res.json())
            .then(setData)
            .catch(setError)
            .finally(() => setLoading(false));
    }, []);
    // ...
}

function ProductList() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);  // 重复
    const [error, setError] = useState(null);
    
    useEffect(() => {
        fetch('/api/products')  // 只有 URL 不同
            .then(res => res.json())
            .then(setData)
            .catch(setError)
            .finally(() => setLoading(false));
    }, []);
    // ...
}
```

### After
```jsx
// hooks/useFetch.js
function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        fetch(url)
            .then(res => res.json())
            .then(setData)
            .catch(setError)
            .finally(() => setLoading(false));
    }, [url]);
    
    return { data, loading, error };
}

// 使用
function UserProfile() {
    const { data, loading, error } = useFetch('/api/user');
    // ...
}

function ProductList() {
    const { data, loading, error } = useFetch('/api/products');
    // ...
}
```

---

## 5. 装饰器模式 (Python)

### Before
```python
def get_user(user_id):
    start = time.time()
    try:
        result = db.query(f"SELECT * FROM users WHERE id={user_id}")
        logger.info(f"get_user took {time.time()-start}s")
        return result
    except Exception as e:
        logger.error(f"get_user failed: {e}")
        raise

def get_order(order_id):
    start = time.time()  # 重复的计时逻辑
    try:
        result = db.query(f"SELECT * FROM orders WHERE id={order_id}")
        logger.info(f"get_order took {time.time()-start}s")
        return result
    except Exception as e:
        logger.error(f"get_order failed: {e}")  # 重复的错误处理
        raise
```

### After
```python
import functools
import time

def log_execution(func):
    """装饰器：记录执行时间和异常"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = func(*args, **kwargs)
            logger.info(f"{func.__name__} took {time.time()-start:.3f}s")
            return result
        except Exception as e:
            logger.error(f"{func.__name__} failed: {e}")
            raise
    return wrapper

@log_execution
def get_user(user_id):
    return db.query(f"SELECT * FROM users WHERE id={user_id}")

@log_execution
def get_order(order_id):
    return db.query(f"SELECT * FROM orders WHERE id={order_id}")
```

---

## 6. 配置中心化

### Before
```python
# api.py
BASE_URL = "https://api.example.com"
TIMEOUT = 30

# auth.py
AUTH_URL = "https://api.example.com/auth"  # 重复基础 URL
TOKEN_EXPIRY = 3600

# storage.py
STORAGE_URL = "https://api.example.com/storage"  # 又重复
MAX_FILE_SIZE = 10 * 1024 * 1024
```

### After
```python
# config.py
from dataclasses import dataclass

@dataclass(frozen=True)
class Config:
    BASE_URL: str = "https://api.example.com"
    TIMEOUT: int = 30
    TOKEN_EXPIRY: int = 3600
    MAX_FILE_SIZE: int = 10 * 1024 * 1024
    
    @property
    def auth_url(self) -> str:
        return f"{self.BASE_URL}/auth"
    
    @property
    def storage_url(self) -> str:
        return f"{self.BASE_URL}/storage"

config = Config()

# 使用
from config import config
response = requests.get(config.auth_url, timeout=config.TIMEOUT)
```

---

## 7. 通用 API 客户端

### Before
```typescript
async function getUser(id: string) {
    const res = await fetch(`/api/users/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
}

async function getProducts() {
    const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }  // 重复
    });
    if (!res.ok) throw new Error('Failed');  // 重复
    return res.json();
}
```

### After
```typescript
// api/client.ts
class ApiClient {
    constructor(private baseUrl: string, private token: string) {}
    
    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                ...options?.headers,
            },
        });
        if (!res.ok) {
            throw new ApiError(res.status, await res.text());
        }
        return res.json();
    }
    
    get<T>(endpoint: string) { return this.request<T>(endpoint); }
    post<T>(endpoint: string, data: unknown) {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
}

// 使用
const api = new ApiClient('/api', token);
const user = await api.get<User>(`/users/${id}`);
const products = await api.get<Product[]>('/products');
```
