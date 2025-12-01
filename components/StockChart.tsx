import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { StockData } from '../types';

interface StockChartProps {
  data: number[];
  color: string;
}

const StockChart: React.FC<StockChartProps> = ({ data, color }) => {
  const chartData = data.map((val, idx) => ({ i: idx, price: val }));
  const min = Math.min(...data);
  const max = Math.max(...data);

  return (
    <div className="w-full h-32 mt-4 touch-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`colorGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis domain={[min - (max-min)*0.1, max + (max-min)*0.1]} hide />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1C1C1E', borderColor: '#333', borderRadius: '10px', fontSize: '12px' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => [value.toFixed(1), 'Price']}
            labelStyle={{ display: 'none' }}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#colorGradient-${color})`} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;