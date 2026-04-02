from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import models, schemas, database
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mario Game API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "super_secret_mario_key_2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@app.post("/api/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.username}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "username": user.username, "user_id": user.id}

@app.get("/api/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/scores")
def submit_score(score: schemas.ScoreCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_score = models.Score(
        user_id=current_user.id,
        score=score.score,
        level=score.level,
        coins=score.coins,
        time_seconds=score.time_seconds
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    # Update best score
    best = db.query(models.BestScore).filter(models.BestScore.user_id == current_user.id).first()
    if not best:
        best = models.BestScore(user_id=current_user.id, best_score=score.score, best_level=score.level)
        db.add(best)
    elif score.score > best.best_score:
        best.best_score = score.score
        best.best_level = score.level
        best.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Score saved", "score_id": db_score.id}

@app.get("/api/leaderboard")
def get_leaderboard(limit: int = 10, db: Session = Depends(get_db)):
    results = (
        db.query(models.BestScore, models.User)
        .join(models.User, models.BestScore.user_id == models.User.id)
        .order_by(models.BestScore.best_score.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "rank": i + 1,
            "username": user.username,
            "best_score": bs.best_score,
            "best_level": bs.best_level,
            "updated_at": bs.updated_at.isoformat() if bs.updated_at else None
        }
        for i, (bs, user) in enumerate(results)
    ]

@app.get("/api/my-scores")
def get_my_scores(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    scores = db.query(models.Score).filter(models.Score.user_id == current_user.id).order_by(models.Score.created_at.desc()).limit(10).all()
    return scores

@app.get("/")
def root():
    return {"message": "Mario Game API running"}
