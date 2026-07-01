import { FC } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { formatNumber, formatPercent } from '../lib/utils';

interface GoalChartProps {
  inscritos: number;
  meta: number;
}

export const GoalChart: FC<GoalChartProps> = ({ inscritos, meta }) => {
  const percent = meta > 0 ? inscritos / meta : 0;
  const clamped = Math.min(Math.max(percent, 0), 1);
  const faltam = Math.max(meta - inscritos, 0);
  const atingiuMeta = inscritos >= meta;

  const chartData = [{ name: 'Inscritos', value: clamped * 100, fill: '#00E330' }];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="w-full border border-bg-card-border bg-bg-card rounded-2xl p-6"
    >
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-white">Meta de Inscrições</h3>
        <p className="text-sm text-gray-500">Total de inscritos rumo à meta esperada</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Gauge */}
        <div className="relative w-full h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="72%"
              outerRadius="100%"
              data={chartData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: '#1F2225' }}
                dataKey="value"
                cornerRadius={30}
                angleAxisId={0}
                animationDuration={1500}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-4xl font-bold text-in-green">{formatPercent(percent)}</span>
            <span className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1">da meta</span>
          </div>
        </div>

        {/* Números */}
        <div className="flex flex-col divide-y divide-bg-card-border">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-400">Inscritos</span>
            <span className="text-2xl font-bold text-white">{formatNumber(inscritos)}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-400">Meta</span>
            <span className="text-2xl font-bold text-white">{formatNumber(meta)}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-400">{atingiuMeta ? 'Excedente' : 'Faltam'}</span>
            <span className={atingiuMeta ? 'text-2xl font-bold text-in-green' : 'text-2xl font-bold text-white'}>
              {atingiuMeta ? `+${formatNumber(inscritos - meta)}` : formatNumber(faltam)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
