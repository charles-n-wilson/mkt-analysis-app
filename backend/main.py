from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import List, Dict
import numpy as np

app = FastAPI()

# Add CORS middleware
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
        "iron_basket": ['RIO.AX', 'FMG.AX', 'CIA.AX', 'MGT.AX', 'GRR.AX'],
        "lithium_basket": ['PLS.AX', 'MIN.AX', 'LTR.AX', 'IGO.AX', 'AGY.AX']
    },
    "FTSE 100": {
        "index": "^FTSE",
        "iron_basket": ['RIO.L', 'ANTO.L', 'BHP.L', 'GLEN.L', 'AAL.L'],
        "lithium_basket": ['INL.L', 'SGML', 'LAC', 'ALB', 'SQM', 'ALTM']
    },
    "S&P 500": {
        "index": "^GSPC",
        "iron_basket": ['CLF', 'X', 'NUE', 'STLD', 'RS'],
        "lithium_basket": ['ALB', 'LTHM', 'LAC', 'PLL', 'SQM']
    },
    "S&P/TSX Composite": {
    "index": "^GSPTSE",
    "iron_basket": ['RIO.L', 'BHP.L', 'VALE', 'FMG.AX', 'STLD'],
    "lithium_basket": ['CRE.V)', 'SQM', 'PLL', 'ALB', 'FM.TO', 'ALTM']
    },
    "Brazil IBOV": {
        "index": "^BVSP",
        "iron_basket": ['VALE', 'BHP.L', 'FMG.AX', 'STLD', 'RIO.L'],
        "lithium_basket": ['LTHM', 'SQM', 'PLS.AX', 'MIN.AX', 'GXY.AX']
    }
}

@app.get("/api/market-data/{market_index}")
async def get_market_data(market_index: str, start_date: str = '2020-01-01'):
    if market_index not in MARKET_INDICES:
        raise HTTPException(status_code=404, detail="Market index not found")
    
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
        
        df['Index_Returns'] = df['Index'].pct_change() * 100
        df['Iron_Returns'] = df['Iron'].pct_change() * 100
        df['Lithium_Returns'] = df['Lithium'].pct_change() * 100
        
        # Clean data and prepare response
        df = df.dropna()
        
        # Calculate correlations
        iron_corr = df['Index_Returns'].corr(df['Iron_Returns'])
        lithium_corr = df['Index_Returns'].corr(df['Lithium_Returns'])
        
        # Prepare data for charts
        response_data = {
            "timeSeriesData": df.index.strftime('%Y-%m-%d').tolist(),
            "indexReturns": df['Index_Returns'].round(2).tolist(),
            "ironReturns": df['Iron_Returns'].round(2).tolist(),
            "lithiumReturns": df['Lithium_Returns'].round(2).tolist(),
            "correlations": {
                "iron": round(iron_corr, 3),
                "lithium": round(lithium_corr, 3)
            },
            "distributionData": {
                "bins": np.histogram(df['Index_Returns'], bins=30)[0].tolist(),
                "binEdges": np.histogram(df['Index_Returns'], bins=30)[1].tolist()
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