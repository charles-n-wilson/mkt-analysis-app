"use client"; 

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar } from 'recharts';

const TIME_PERIODS = {
  '1M': '1 Month',
  '3M': '3 Months',
  '6M': '6 Months',
  '1Y': '1 Year',
  '3Y': '3 Years',
  'ALL': 'All Time'
};

const MarketAnalysisDashboard = () => {
  const [selectedIndex, setSelectedIndex] = useState('ASX');
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [marketData, setMarketData] = useState(null);
  const [availableIndices, setAvailableIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch the list of available indices
  useEffect(() => {
    fetch('http://localhost:8000/api/available-indices')
      .then(response => response.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableIndices(data);
        } else {
          console.error('Invalid response for available indices:', data);
        }
      })
      .catch(error => console.error('Error fetching indices:', error));
  }, []);

  // Fetch market data for the selected index and period
  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/market-data/${selectedIndex}?period=${selectedPeriod}`)
      .then(response => response.json())
      .then(data => {
        if (!data || !data.timeSeriesData || !Array.isArray(data.timeSeriesData)) {
          console.error('Invalid market data response:', data);
          setLoading(false);
          return;
        }

        // Process time series data with formatted dates
        const processedData = data.timeSeriesData.map((date, index) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' }),
          indexReturn: data.indexReturns?.[index] || 0,
          ironReturn: data.ironReturns?.[index] || 0,
          lithiumReturn: data.lithiumReturns?.[index] || 0,
        }));

        // Process distribution data
        const distributionData = (data.distributionData?.bins || []).map((count, index) => ({
          bin: Number(((data.distributionData?.binEdges?.[index] || 0) + 
                (data.distributionData?.binEdges?.[index + 1] || 0)) / 2).toFixed(3),
          count,
        }));

        // Update state with processed data
        setMarketData({
          timeSeriesData: processedData,
          correlations: data.correlations || { iron: 0, lithium: 0 },
          distributionData,
        });
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching market data:', error);
        setLoading(false);
      });
  }, [selectedIndex, selectedPeriod]);

  const calculateRegressionLine = (data, xKey, yKey, correlation) => {
    if (!data.length) return [];
    
    // Calculate means
    const xMean = data.reduce((sum, point) => sum + point[xKey], 0) / data.length;
    const yMean = data.reduce((sum, point) => sum + point[yKey], 0) / data.length;
    
    // Calculate standard deviations
    const xStd = Math.sqrt(data.reduce((sum, point) => sum + Math.pow(point[xKey] - xMean, 2), 0) / data.length);
    const yStd = Math.sqrt(data.reduce((sum, point) => sum + Math.pow(point[yKey] - yMean, 2), 0) / data.length);
    
    // Calculate slope using correlation
    const slope = correlation * (yStd / xStd);
    const intercept = yMean - slope * xMean;
    
    // Get min and max x values
    const xMin = Math.min(...data.map(point => point[xKey]));
    const xMax = Math.max(...data.map(point => point[xKey]));
    
    // Create line points
    return [
      { x: xMin, y: slope * xMin + intercept },
      { x: xMax, y: slope * xMax + intercept }
    ];
  };

  const calculateRSquared = (correlation: number) => {
    return (correlation * correlation).toFixed(3);
  };

  if (loading || !marketData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Loading market data...</p>
      </div>
    );
  }

  const ironRegressionLine = calculateRegressionLine(
    marketData.timeSeriesData,
    'ironReturn',
    'indexReturn',
    marketData.correlations.iron
  );

  const lithiumRegressionLine = calculateRegressionLine(
    marketData.timeSeriesData,
    'lithiumReturn',
    'indexReturn',
    marketData.correlations.lithium
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex gap-4">
        <Select value={selectedIndex} onValueChange={setSelectedIndex}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select market index" />
          </SelectTrigger>
          <SelectContent>
            {availableIndices.map(index => (
              <SelectItem key={index} value={index}>
                {index}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIME_PERIODS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Time Series Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} Returns Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marketData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    angle={-45} 
                    textAnchor="end"
                  />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="indexReturn" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Scatter Chart for Iron Returns */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} vs Iron Ore Basket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="ironReturn" name="Iron Returns" />
                  <YAxis type="number" dataKey="indexReturn" name="Index Returns" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={marketData.timeSeriesData} fill="#8884d8" />
                  <Line
                    data={ironRegressionLine}
                    type="monotone"
                    dataKey="y"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={false}
                    legendType="none"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm mt-2 space-y-1">
              <p>Correlation: {marketData.correlations.iron}</p>
              <p>R²: {calculateRSquared(marketData.correlations.iron)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Scatter Chart for Lithium Returns */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} vs Lithium Basket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="lithiumReturn" name="Lithium Returns" />
                  <YAxis type="number" dataKey="indexReturn" name="Index Returns" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={marketData.timeSeriesData} fill="#82ca9d" />
                  <Line
                    data={lithiumRegressionLine}
                    type="monotone"
                    dataKey="y"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    dot={false}
                    legendType="none"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm mt-2 space-y-1">
              <p>Correlation: {marketData.correlations.lithium}</p>
              <p>R²: {calculateRSquared(marketData.correlations.lithium)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Returns Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} Returns Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketData.distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bin" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketAnalysisDashboard;