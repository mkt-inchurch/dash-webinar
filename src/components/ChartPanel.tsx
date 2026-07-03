import { FC } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardData } from '../types';
import { GoalChart } from './GoalChart';
import { META_INSCRITOS } from '../lib/constants';
import { formatCurrency, formatNumber } from '../lib/utils';

interface ChartSpec {
  type: 'gauge' | 'bar';
  title?: string;
  subtitle?: string;
  format?: 'number' | 'currency';
  highlight?: string;
  highlightAll?: boolean;
  data?: { name: string; value: number }[];
}

function getChartSpec(key: string, data: DashboardData): ChartSpec {
  const funnel = [
    { name: 'Inscritos', value: data.inscritos },
    { name: 'Grupo', value: data.entradasGrupo },
    { name: 'Pesquisas', value: data.pesquisas },
    { name: 'ICPs', value: data.icps },
    { name: 'Diagnósticos', value: data.diagnosticos },
  ];

  switch (key) {
    case 'inscritos':
      return { type: 'gauge' };
    case 'entradasGrupo':
      return { type: 'bar', title: 'Funil de Conversão', subtitle: 'Etapa destacada: Entradas no Grupo', format: 'number', highlight: 'Grupo', data: funnel };
    case 'pesquisas':
      return { type: 'bar', title: 'Funil de Conversão', subtitle: 'Etapa destacada: Pesquisas', format: 'number', highlight: 'Pesquisas', data: funnel };
    case 'icps':
      if (data.icp) {
        return {
          type: 'bar',
          title: 'Perfis de ICP (P1–P4)',
          subtitle: 'Leads qualificados por perfil · dedup por e-mail, a partir de 19/06',
          format: 'number',
          highlightAll: true,
          data: [
            { name: 'P1', value: data.icp.p1 },
            { name: 'P2', value: data.icp.p2 },
            { name: 'P3', value: data.icp.p3 },
            { name: 'P4', value: data.icp.p4 },
          ],
        };
      }
      return { type: 'bar', title: 'Funil de Conversão', subtitle: 'Etapa destacada: ICPs', format: 'number', highlight: 'ICPs', data: funnel };
    case 'diagnosticos':
      return { type: 'bar', title: 'Funil de Conversão', subtitle: 'Etapa destacada: Diagnósticos', format: 'number', highlight: 'Diagnósticos', data: funnel };
    case 'investimentoTrafego':
      return {
        type: 'bar',
        title: 'Orçamento: Previsto vs Investido',
        subtitle: 'Planejado (Leads × CPL Meta) vs valor realizado',
        format: 'currency',
        highlight: 'Investido',
        data: [
          { name: 'Previsto', value: data.leadsMeta * data.cplMeta },
          { name: 'Investido', value: data.investimentoTrafego },
        ],
      };
    case 'leadsMeta':
      return {
        type: 'bar',
        title: 'Leads: Meta vs Real',
        subtitle: 'Leads previstos vs inscritos reais',
        format: 'number',
        highlight: 'Meta',
        data: [
          { name: 'Meta', value: data.leadsMeta },
          { name: 'Real (Inscritos)', value: data.inscritos },
        ],
      };
    case 'inscritosAds':
      return {
        type: 'bar',
        title: 'Tráfego: Leads (Meta) vs Inscritos ADS',
        subtitle: 'Leads reportados pelo Meta vs quem realmente se inscreveu (UTM WEBINAR_IA)',
        format: 'number',
        highlight: 'Inscritos ADS',
        data: [
          { name: 'Leads (Meta)', value: data.leadsMeta },
          { name: 'Inscritos ADS', value: data.inscritosAds ?? 0 },
        ],
      };
    case 'cplMeta':
      return {
        type: 'bar',
        title: 'CPL: Meta vs Real',
        subtitle: 'Custo por lead planejado vs realizado',
        format: 'currency',
        highlight: 'Meta',
        data: [
          { name: 'Meta', value: data.cplMeta },
          { name: 'Real', value: data.cplReal },
        ],
      };
    case 'cplReal':
      return {
        type: 'bar',
        title: 'CPL: Meta vs Real',
        subtitle: 'Meta (planejado) vs Real (Investimento ÷ Inscritos ADS)',
        format: 'currency',
        highlight: 'Real',
        data: [
          { name: 'Meta', value: data.cplMeta },
          { name: 'Real', value: data.cplReal },
        ],
      };
    default:
      return { type: 'gauge' };
  }
}

interface ChartPanelProps {
  selected: string;
  data: DashboardData;
}

export const ChartPanel: FC<ChartPanelProps> = ({ selected, data }) => {
  const spec = getChartSpec(selected, data);

  if (spec.type === 'gauge') {
    return (
      <motion.div key={selected} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GoalChart inscritos={data.inscritos} meta={META_INSCRITOS} />
      </motion.div>
    );
  }

  const fmt = spec.format === 'currency' ? formatCurrency : formatNumber;

  return (
    <motion.div
      key={selected}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full border border-bg-card-border bg-bg-card rounded-2xl p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">{spec.title}</h3>
        <p className="text-sm text-gray-500">{spec.subtitle}</p>
      </div>

      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={spec.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2225" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 12 }}
              tickFormatter={(v) => (spec.format === 'currency' ? `R$${formatNumber(v)}` : formatNumber(v))}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0F1012', borderColor: '#1F2225', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#00E330' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              formatter={(value: number) => [fmt(value), 'Valor']}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
              {spec.data!.map((entry, index) => (
                <Cell key={index} fill={spec.highlightAll || entry.name === spec.highlight ? '#00E330' : '#2A2F35'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
