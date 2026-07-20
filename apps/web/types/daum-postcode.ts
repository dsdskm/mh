export type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: "Y" | "N";
};

export type DaumPostcodeInstance = {
  open: () => void;
};

export type DaumPostcodeConstructor = new (options: {
  oncomplete: (data: DaumPostcodeData) => void;
}) => DaumPostcodeInstance;

export type DaumPostcodeWindow = {
  Postcode: DaumPostcodeConstructor;
};