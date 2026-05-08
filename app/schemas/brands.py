from typing import Optional
from pydantic import BaseModel

class BrandBase(BaseModel):
    name: str
    logo_url: Optional[str] = None

class BrandCreate(BrandBase):
    pass

class BrandUpdate(BrandBase):
    pass

class BrandResponse(BrandBase):
    id: str
    product_count: int = 0

    class Config:
        from_attributes = True
