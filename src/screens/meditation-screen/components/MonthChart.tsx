import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { DayMinutes, dateKeyISO } from "../../../services/meditationService";

const CHART_H = 96;
const BAR_W = 10;
const GAP = 5;

function dayNumLabel(dateStr: string): string {
  const parts = dateStr.split("-");
  const d = parseInt(parts[2] || "1", 10);
  return String(d);
}

interface Props {
  data: DayMinutes[];
  daysActive: number;
  monthTitle: string;
}

const MonthChart: React.FC<Props> = ({ data, daysActive, monthTitle }) => {
  const { width: screenW } = useWindowDimensions();
  const maxMin = useMemo(
    () => Math.max(...data.map((x) => x.minutes), 1),
    [data]
  );

  const chartW = data.length * (BAR_W + GAP) - GAP + 16;
  const scroll = chartW > screenW - 40;

  const inner = (
    <Svg width={chartW} height={CHART_H + 28} style={styles.svg}>
      {data.map((d, i) => {
        const barH = Math.max(3, (d.minutes / maxMin) * CHART_H);
        const x = i * (BAR_W + GAP) + 8;
        const y = CHART_H - barH;
        const today = dateKeyISO(new Date()) === d.date;

        return (
          <React.Fragment key={d.date}>
            <Rect
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              rx={3}
              fill={d.minutes > 0 ? (today ? "#5B7553" : "#A3C39B") : "#e2e8f0"}
            />
            {d.minutes > 0 && (
              <SvgText
                x={x + BAR_W / 2}
                y={y - 4}
                fill="#64748b"
                fontSize={8}
                fontWeight="700"
                textAnchor="middle"
              >
                {d.minutes}
              </SvgText>
            )}
            <SvgText
              x={x + BAR_W / 2}
              y={CHART_H + 14}
              fill={today ? "#5B7553" : "#94a3b8"}
              fontSize={9}
              fontWeight={today ? "800" : "600"}
              textAnchor="middle"
            >
              {dayNumLabel(d.date)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {monthTitle} · {daysActive} day{daysActive === 1 ? "" : "s"} active
      </Text>
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 10,
  },
  svg: {
    alignSelf: "center",
  },
  scrollContent: {
    paddingRight: 8,
  },
});

export default React.memo(MonthChart);
