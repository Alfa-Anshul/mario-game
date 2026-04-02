from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://mario:mariopass123@db:5432/mariodb")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    scores = relationship("Score", back_populates="user")
    best_score = relationship("BestScore", back_populates="user", uselist=False)

class Score(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)
    level = Column(Integer, default=1)
    coins = Column(Integer, default=0)
    time_seconds = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="scores")

class BestScore(Base):
    __tablename__ = "best_scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    best_score = Column(Integer, nullable=False)
    best_level = Column(Integer, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="best_score")

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    class Config:
        from_attributes = True

class ScoreCreate(BaseModel):
    score: int
    level: int
    coins: int
    time_seconds: float

SECRET_KEY = "super_secret_mario_key_2024"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def hash_password(password): return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username: raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.username == username).first()
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return user

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Mario Game API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.post("/api/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    db_user = User(username=user.username, email=user.email, hashed_password=hash_password(user.password))
    db.add(db_user); db.commit(); db.refresh(db_user)
    return db_user

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.username}, timedelta(minutes=60*24))
    return {"access_token": token, "token_type": "bearer", "username": user.username, "user_id": user.id}

@app.get("/api/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)): return current_user

@app.post("/api/scores")
def submit_score(score: ScoreCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_score = Score(user_id=current_user.id, score=score.score, level=score.level, coins=score.coins, time_seconds=score.time_seconds)
    db.add(db_score); db.commit(); db.refresh(db_score)
    best = db.query(BestScore).filter(BestScore.user_id == current_user.id).first()
    if not best:
        best = BestScore(user_id=current_user.id, best_score=score.score, best_level=score.level); db.add(best)
    elif score.score > best.best_score:
        best.best_score = score.score; best.best_level = score.level; best.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Score saved"}

@app.get("/api/leaderboard")
def get_leaderboard(limit: int = 10, db: Session = Depends(get_db)):
    results = db.query(BestScore, User).join(User, BestScore.user_id == User.id).order_by(BestScore.best_score.desc()).limit(limit).all()
    return [{"rank": i+1, "username": u.username, "best_score": bs.best_score, "best_level": bs.best_level, "updated_at": bs.updated_at.isoformat() if bs.updated_at else None} for i, (bs, u) in enumerate(results)]

@app.get("/api/my-scores")
def get_my_scores(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scores = db.query(Score).filter(Score.user_id == current_user.id).order_by(Score.created_at.desc()).limit(10).all()
    return [{"id": s.id, "score": s.score, "level": s.level, "coins": s.coins, "created_at": s.created_at.isoformat()} for s in scores]

@app.get("/")
def root(): return {"message": "Mario Game API"}
