import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { DayMinutes, getDayLabel } from "../../../services/meditationService";

interface Props {
  data: DayMinutes[];
}

const CHART_H = 120;
const BAR_W = 28;
const GAP = 10;

const WeekChart: React.FC<Props> = ({ data }) => {
  const maxMin = useMemo(() => Math.max(...data.map((d) => d.minutes), 1), [data]);

  const chartW = data.length * (BAR_W + GAP) - GAP + 20;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week</Text>
      <Svg width={chartW} height={CHART_H + 36} style={styles.svg}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.minutes / maxMin) * CHART_H);
          const x = i * (BAR_W + GAP) + 10;
          const y = CHART_H - barH;
          const isToday = i === data.length - 1;

          return (
            <React.Fragment key={d.date}>
              <Rect
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                rx={6}
                fill={isToday ? "#5B7553" : "#e2e8f0"}
              />
              {d.minutes > 0 && (
                <SvgText
                  x={x + BAR_W / 2}
                  y={y - 6}
                  fill="#64748b"
                  fontSize={10}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {d.minutes}m
                </SvgText>
              )}
              <SvgText
                x={x + BAR_W / 2}
                y={CHART_H + 16}
                fill={isToday ? "#5B7553" : "#94a3b8"}
                fontSize={10}
                fontWeight={isToday ? "800" : "600"}
                textAnchor="middle"
              >
                {getDayLabel(d.date)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
  },
  svg: {
    alignSelf: "center",
  },
});

export default React.memo(WeekChart);
