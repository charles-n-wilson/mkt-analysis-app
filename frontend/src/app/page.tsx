"use client"; 

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar } from 'recharts';

const MarketAnalysisDashboard = () => {
  const [selectedIndex, setSelectedIndex] = useState('ASX');
  const [marketData, setMarketData] = useState(null);
  const [availableIndices, setAvailableIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/available-indices')
      .then(response => response.json())
      .then(data => setAvailableIndices(data))
      .catch(error => console.error('Error fetching indices:', error));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/market-data/${selectedIndex}`)
      .then(response => response.json())
      .then(data => {
        const processedData = data.timeSeriesData.map((date, index) => ({
          date,
          indexReturn: data.indexReturns[index],
          ironReturn: data.ironReturns[index],
          lithiumReturn: data.lithiumReturns[index]
        }));

        const distributionData = data.distributionData.bins.map((count, index) => ({
          bin: (data.distributionData.binEdges[index] + data.distributionData.binEdges[index + 1]) / 2,
          count
        }));

        setMarketData({
          timeSeriesData: processedData,
          correlations: data.correlations,
          distributionData
        });
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching market data:', error);
        setLoading(false);
      });
  }, [selectedIndex]);

  if (loading || !marketData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Loading market data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
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
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} Returns Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marketData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="indexReturn" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} vs Iron Ore Basket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="ironReturn" name="Iron Returns" />
                  <YAxis type="number" dataKey="indexReturn" name="Index Returns" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={marketData.timeSeriesData} fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm mt-2">Correlation: {marketData.correlations.iron}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedIndex} vs Lithium Basket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="lithiumReturn" name="Lithium Returns" />
                  <YAxis type="number" dataKey="indexReturn" name="Index Returns" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={marketData.timeSeriesData} fill="#82ca9d" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm mt-2">Correlation: {marketData.correlations.lithium}</p>
          </CardContent>
        </Card>

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
