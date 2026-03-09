import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

interface LineGraphProps {
  data: { t: number; value: number }[];
  xLabel?: string;
  yLabel?: string;
  color?: string;
}

export const ResponseGraph = ({ data, xLabel = 'Time (s)', yLabel = 'Value', color = 'hsl(185, 80%, 50%)' }: LineGraphProps) => {
  // Downsample if too many points
  const maxPoints = 100;
  const step = Math.max(1, Math.floor(data.length / maxPoints));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="w-full h-52 mt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampled} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis 
            dataKey="t" 
            tick={{ fontSize: 10, fill: 'hsl(215, 12%, 50%)' }}
            tickFormatter={(v: number) => v < 0.01 ? v.toExponential(1) : v.toFixed(3)}
            label={{ value: xLabel, position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: 'hsl(215, 12%, 50%)' } }}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: 'hsl(215, 12%, 50%)' }}
            tickFormatter={(v: number) => Math.abs(v) < 0.01 ? v.toExponential(1) : v.toFixed(2)}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(215, 12%, 50%)' } }}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(220, 22%, 10%)', 
              border: '1px solid hsl(220, 15%, 18%)', 
              borderRadius: '6px',
              fontSize: 11, 
              fontFamily: 'JetBrains Mono, monospace' 
            }}
            formatter={(value: number) => [value.toFixed(6), yLabel]}
            labelFormatter={(label: number) => `t = ${label.toExponential(3)}s`}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface DualLineGraphProps {
  data1: { t: number; value: number }[];
  data2: { t: number; value: number }[];
  label1?: string;
  label2?: string;
  yLabel?: string;
}

export const DualResponseGraph = ({ data1, data2, label1 = 'v_C(t)', label2 = 'i_L(t)', yLabel = 'Value' }: DualLineGraphProps) => {
  const maxPoints = 100;
  const step = Math.max(1, Math.floor(data1.length / maxPoints));
  
  const merged = data1
    .filter((_, i) => i % step === 0 || i === data1.length - 1)
    .map((d, i) => ({
      t: d.t,
      v1: d.value,
      v2: data2[i * step]?.value ?? data2[data2.length - 1]?.value ?? 0,
    }));

  return (
    <div className="w-full h-56 mt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis 
            dataKey="t" 
            tick={{ fontSize: 10, fill: 'hsl(215, 12%, 50%)' }}
            tickFormatter={(v: number) => v < 0.01 ? v.toExponential(1) : v.toFixed(3)}
          />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 12%, 50%)' }} />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(220, 22%, 10%)', 
              border: '1px solid hsl(220, 15%, 18%)',
              borderRadius: '6px',
              fontSize: 11, 
              fontFamily: 'JetBrains Mono, monospace' 
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
          <Line type="monotone" dataKey="v1" name={label1} stroke="hsl(185, 80%, 50%)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="v2" name={label2} stroke="hsl(38, 90%, 55%)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface BarGraphProps {
  data: { label: string; value: number }[];
  yLabel?: string;
  color?: string;
}

export const NodeVoltageGraph = ({ data, yLabel = 'Voltage (V)', color = 'hsl(185, 80%, 50%)' }: BarGraphProps) => {
  return (
    <div className="w-full h-48 mt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(215, 12%, 50%)' }} />
          <YAxis 
            tick={{ fontSize: 10, fill: 'hsl(215, 12%, 50%)' }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(215, 12%, 50%)' } }}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: 'hsl(220, 22%, 10%)', 
              border: '1px solid hsl(220, 15%, 18%)',
              borderRadius: '6px',
              fontSize: 11, 
              fontFamily: 'JetBrains Mono, monospace' 
            }}
            formatter={(value: number) => [`${value.toFixed(4)} V`, yLabel]}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
