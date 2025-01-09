from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MARKET_INDICES = {
    "ASX": {
        "index": "^AXJO",
        "iron_basket": ['RIO.AX', 'FMG.AX', 'CIA.AX', 'MGT.AX', 'GRR.AX', 'BHP.AX'],
        "lithium_basket": ['PLS.AX', 'MIN.AX', 'LTR.AX', 'IGO.AX', 'AGY.AX', 'CXO.AX', 'AKE.AX']
    },
    "FTSE 100": {
        "index": "^FTSE",
        "iron_basket": ['RIO.L', 'ANTO.L', 'BHP.L', 'GLEN.L', 'AAL.L'],
        "lithium_basket": ['EMH.L', 'SQM', 'ALTM']
    },
    "S&P 500": {
        "index": "^GSPC",
        "iron_basket": ['CLF', 'X', 'NUE', 'STLD', 'RS'],
        "lithium_basket": ['ALB', 'LAC', 'PLL', 'SQM', 'MP']
    },
    "S&P/TSX Composite": {
        "index": "^GSPTSE",
        "iron_basket": ['BHP.L', 'VALE', 'TCK.B.TO', 'STLD'],
        "lithium_basket": ['LAC.TO', 'SQM', 'PLL', 'ALB', 'FM.TO', 'ALTM']
    },
    "Brazil IBOV": {
        "index": "^BVSP",
        "iron_basket": ['VALE', 'CSNA3.SA', 'FMG.AX', 'STLD'],
        "lithium_basket": ['LTHM', 'SQM', 'PLS.AX', 'MIN.AX']
    }
}

def get_start_date(period: str) -> str:
    today = datetime.now()
    if period == '1M':
        start_date = today - timedelta(days=30)
    elif period == '3M':
        start_date = today - timedelta(days=90)
    elif period == '6M':
        start_date = today - timedelta(days=180)
    elif period == '1Y':
        start_date = today - timedelta(days=365)
    elif period == '3Y':
        start_date = today - timedelta(days=3*365)
    else:  # 'ALL' or default
        start_date = datetime(2020, 1, 1)
    
    return start_date.strftime('%Y-%m-%d')

@app.get("/api/market-data/{market_index}")
async def get_market_data(market_index: str, period: str = '1Y'):
    if market_index not in MARKET_INDICES:
        raise HTTPException(status_code=404, detail="Market index not found")
    
    start_date = get_start_date(period)
    end_date = datetime.now().strftime('%Y-%m-%d')
    market_config = MARKET_INDICES[market_index]
    
    try:
        # Fetch index data
        index_data = yf.download(market_config["index"], start=start_date, end=end_date)['Close']
        
        # Fetch basket data
        iron_data = pd.DataFrame()
        lithium_data = pd.DataFrame()
        
        for stock in market_config["iron_basket"]:
            try:
                iron_data[stock] = yf.download(stock, start=start_date, end=end_date)['Close']
            except:
                print(f"Failed to fetch {stock}")
                
        for stock in market_config["lithium_basket"]:
            try:
                lithium_data[stock] = yf.download(stock, start=start_date, end=end_date)['Close']
            except:
                print(f"Failed to fetch {stock}")
        
        # Calculate basket indices and returns
        df = pd.DataFrame()
        df['Index'] = index_data
        df['Iron'] = iron_data.mean(axis=1)
        df['Lithium'] = lithium_data.mean(axis=1)
        
        # Calculate returns with 2 decimal places precision
        df['Index_Returns'] = (df['Index'].pct_change() * 100).round(2)
        df['Iron_Returns'] = (df['Iron'].pct_change() * 100).round(2)
        df['Lithium_Returns'] = (df['Lithium'].pct_change() * 100).round(2)
        
        # Clean data and prepare response
        df = df.dropna()
        
        # Calculate correlations with 3 decimal places
        iron_corr = round(df['Index_Returns'].corr(df['Iron_Returns']), 3)
        lithium_corr = round(df['Index_Returns'].corr(df['Lithium_Returns']), 3)
        
        # Calculate histogram with rounded bin edges (2 decimal places)
        hist, bin_edges = np.histogram(df['Index_Returns'], bins=30)
        bin_edges = np.round(bin_edges, 2)
        
        # Prepare response data
        response_data = {
            "timeSeriesData": df.index.strftime('%Y-%m-%d').tolist(),
            "indexReturns": df['Index_Returns'].tolist(),
            "ironReturns": df['Iron_Returns'].tolist(),
            "lithiumReturns": df['Lithium_Returns'].tolist(),
            "correlations": {
                "iron": iron_corr,
                "lithium": lithium_corr
            },
            "distributionData": {
                "bins": hist.tolist(),
                "binEdges": bin_edges.tolist()
            }
        }
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/available-indices")
async def get_available_indices():
    return list(MARKET_INDICES.keys())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)