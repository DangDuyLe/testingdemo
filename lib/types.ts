export interface SearchData {
  transactions: any[];
  walletInfo: any;
  portfolio: any;
  nfts: any[];
}

export interface WalletInfoProps {
  data: any;
}

export interface PortfolioProps {
  data: any;
}

export interface TransactionGraphProps {
  data: any[];
}

export interface TransactionTableProps {
  data?: any[];
}

export interface NFTGalleryProps {
  data: any[];
} 